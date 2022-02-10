import { MongoClient } from 'mongodb';
import { Formatters } from 'discord.js';
import chalk from 'chalk';

import differenceInMilliseconds from 'date-fns/differenceInMilliseconds';
import isFirstDayOfMonth from 'date-fns/isFirstDayOfMonth';
import addMonths from 'date-fns/addMonths';

import type { AnyBulkWriteOperation } from 'mongodb';
import type { Event } from '@client/types';
import type { AM4 } from '@typings/database';

type AllianceDocument = AM4.Alliance & { members: AM4.AllianceMember[] };
type AllianceBulkWriteOperation = AnyBulkWriteOperation<AM4.Alliance>;
type MemberBulkWriteOperation = AnyBulkWriteOperation<AM4.AllianceMember>;

const event: Event = {
    name: "dataUpdate",
    once: true,
    async execute({ log, rest }) {
        let requestsRemaining: number;
        const label = chalk.yellow("Data update");
        console.time(label);
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl === undefined) throw new Error("DATABASE_URL must be provided!");
        MongoClient.connect(databaseUrl, async (err, database) => {
            if (err) throw err;
            const am4 = database.db("AM4");
            const allianceCollection = am4.collection<AM4.Alliance>('Alliances');
            const memberCollection = am4.collection<AM4.AllianceMember>('Members');
            const alliances = await allianceCollection.aggregate<AllianceDocument>([
                {
                    $match: {
                        archived: {
                            $exists: false
                        }
                    }
                },
                { 
                    $lookup: {
                        from: 'Members',
                        localField: '_id',
                        foreignField: 'allianceID',
                        as: 'members'
                    }
                }
            ]).toArray();
            const today = new Date();
            const expireDate = addMonths(today, 3);
            const allianceOperations: AllianceBulkWriteOperation[] = [];
            const memberOperations: MemberBulkWriteOperation[] = [];
            for (const allianceDocument of alliances) {
                if (allianceDocument.archived) continue;
                const { members, alliance, status } = await rest.fetchAlliance(allianceDocument.name);
                requestsRemaining = status.requestsRemaining;
                if (status.success) {
                    allianceOperations.push({
                        updateOne: {
                            filter: { _id: allianceDocument._id },
                            update: {
                                $push: {
                                    values: {
                                        $each: [{ value: alliance.value, date: today }],
                                        $slice: -7
                                    }
                                },
                                $set: {
                                    name: alliance.name
                                } 
                            }
                        }
                    });
                    for (const member of members.values()) {
                        const memberDocument = allianceDocument.members.find(({ name }) => name === member.airline.name);
                        const onlineMS = Math.abs(differenceInMilliseconds(today, member.online));
                        if (memberDocument) {
                            if (isFirstDayOfMonth(today)) {
                                if (memberDocument.offline.length >= 4) memberDocument.offline.shift();
                                memberDocument.offline = [ 
                                    ...memberDocument.offline, 
                                    {
                                        date: today,
                                        value: 0
                                    }
                                ];
                            }
                            if (onlineMS > 86400000) memberDocument.offline.last().value++;
                           memberOperations.push({
                                updateOne: {
                                    filter: { _id: memberDocument._id },
                                    update: {
                                        $push: {
                                            dailyContribution: {
                                                $each: [{ 
                                                    value: member.contribution.total - memberDocument.contribution, 
                                                    date: today 
                                                }],
                                                $slice: -7
                                            },
                                            shareValue: {
                                                $each: [{ 
                                                    value: member.shareValue, 
                                                    date: today 
                                                }],
                                                $slice: -7
                                            }
                                        },
                                        $set: {
                                            expireAt: expireDate,
                                            flights: member.flights,
                                            offline: memberDocument.offline,
                                            contribution: member.contribution.total
                                        }
                                    }
                                }
                            });
                        } else {
                            memberOperations.push({
                                insertOne: {
                                    document: {
                                        name: member.airline.name,
                                        allianceID: allianceDocument._id,
                                        joined: member.joined,
                                        flights: member.flights,
                                        contribution: member.contribution.total,
                                        dailyContribution: [],
                                        offline: [{ 
                                            value: Number(onlineMS > 86400000), 
                                            date: today 
                                        }],
                                        shareValue: [{ 
                                            value: member.shareValue, 
                                            date: today 
                                        }],
                                        expireAt: expireDate
                                    }
                                }
                            });
                        }
                    }
                } else {
                    console.error(chalk.red(`Failed to update the data of ${allianceDocument.name}`), JSON.stringify(status, undefined, 4));
                    allianceOperations.push({
                        updateOne: {
                            filter: { _id: allianceDocument._id },
                            update: {
                                $set: {
                                    archived: true
                                }
                            }
                        }
                    });
                }
            }
            if (allianceOperations.length) {
                const allianceBulkWriteResult = await allianceCollection.bulkWrite(allianceOperations);
                const memberBulkWriteResult = await memberCollection.bulkWrite(memberOperations);
                await log.send(`Updated the data of ${Formatters.bold(allianceBulkWriteResult.modifiedCount.toLocaleString('en'))} alliances and ${Formatters.bold(memberBulkWriteResult.modifiedCount.toLocaleString('en'))} members. Inserted ${Formatters.bold(memberBulkWriteResult.insertedCount.toLocaleString('en'))} new members.`);
            } else {
                console.log("No alliance documents were updated...");
            }
            console.timeEnd(label);
            console.info(`Requests remaining: ${requestsRemaining}`);
            await database.close();
        });
    }
}

export = event;