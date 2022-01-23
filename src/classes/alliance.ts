import { Collection } from 'discord.js';
import AM4APIError from './error';
import Airline from './airline';
import Status from './status';
import fetch from 'node-fetch';

import compareAsc from 'date-fns/compareAsc';
import differenceInDays from 'date-fns/differenceInDays';
import differenceInWeeks from 'date-fns/differenceInWeeks';

import type * as AM4 from '@typings/api/am4';
import type AM4Client from '@source/index';

type APIMember = AM4.Alliance['members'][number];

const AM4BaseUrl = "https://www.airline4.net/api";

/**
 * Represents a member of an alliance
 * @constructor
 * @param member - The raw API data of the member
 * @param alliance - The constructed alliance
 * @param client - The AM4 client that was used
 */

export class Member {
    public airline: {
        name: string,
        fetch(): Promise<Airline>
    }
    public position: number;
    public online: Date;
    public flights: number;
    public sv: number;
    public joined: Date;
    public contribution: {
        total: number;
        daily: number;
        season?: number;
        average: {
            day: number;
            week: number;
            flight: number;
        }
    }
    constructor(member: APIMember, public readonly alliance: Alliance['alliance'], protected client: AM4Client) {
        this.airline = {
            name: member.company,
            async fetch() {
                const query = new URLSearchParams({ 
                    access_token: client.am4.accessToken,
                    user: member.company
                });
                const response: AM4.Airline = await fetch(`${AM4BaseUrl}?${query}`).then(response => response.json());
                if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
                return new Airline(response, client)
            }
        }
        this.online = new Date(member.online * 1000);
        this.joined = new Date(member.joined * 1000);
        this.flights = member.flights;
        this.sv = member.shareValue;
        const weeks = Math.abs(differenceInWeeks(this.joined, new Date()));
        const days = Math.abs(differenceInDays(this.joined, new Date()));
        this.contribution = {
            total: member.contributed,
            daily: member.dailyContribution,
            average: {
                day: days > 0 ? (member.contributed / days) : member.contributed,
                week: weeks > 0 ? (member.contributed / weeks) : member.contributed,
                flight: member.contributed / member.flights
            }
        }
        if (alliance.inSeason) this.contribution.season = member.season;
    }
}

/**
 * Represents an alliance
 * @constructor
 * @param data - The raw API data of the alliance
 * @param client - The AM4 client that was used
 */

export default class Alliance extends Status {
    protected _alliance: AM4.Alliance["alliance"];
    protected _members: AM4.Alliance["members"];
    public readonly alliance?: {
        readonly name: string;
        readonly inSeason: boolean;
        rank: number;
        value: number;
        flights: number;
        readonly founded: Date;
        members: {
            amount: number;
            max: number;
        }
        ipo: {
            readonly required: boolean;
            value?: number;
        }
        contribution: {
            total: number;
            daily: number;
            season?: number;
        }
    }
    public readonly members?: Collection<string, Member>;
    constructor({ alliance: alliances, members, status }: AM4.Alliance, protected client: AM4Client) {
        super(status);
        this._members = members;
        this._alliance = alliances;
        if (this.status.success) {
            const [alliance] = alliances;
            this.alliance = {
                name: alliance.name,
                inSeason: members.every(member => member.season !== null),
                rank: alliance.rank,
                value: alliance.value,
                flights: members.map(member => member.flights).reduce((total, current) => total + current),
                founded: members.map(member => new Date(member.joined * 1000)).sort(compareAsc)[0],
                members: {
                    amount: alliance.members,
                    max: alliance.maxMembers
                },
                ipo: {
                    required: Boolean(alliance.ipo)
                },
                contribution: {
                    daily: members.map(member => member.dailyContribution).reduce((total, current) => total + current),
                    total: members.map(member => member.contributed).reduce((total, current) => total + current)
                }
            }
            if (alliance.ipo) this.alliance.ipo.value = alliance.minSV;
            if (this.alliance.inSeason) {
                const total = members.map(member => member.season).reduce((a, b) => a + b);
                this.alliance.contribution.season = total;
            }
            this.members = new Collection(
                members.map((member, i) => {
                    const allianceMember = new Member(member, this.alliance, client);
                    allianceMember.position = i + 1;
                    return [member.company, allianceMember];
                })
            );
        }
    }
}