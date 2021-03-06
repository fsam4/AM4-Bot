import Alliance, { Member } from './alliance';
import AM4APIError from './error';
import { fetch } from 'undici';
import Status from './status';
import Plane from '../lib/plane';

import type { AM4 as AM4Db } from '@typings/database';
import type AM4Client from '@source/index';
import type * as AM4 from '@typings/am4-api';

type AircraftWithAmount = { amount?: number };
type Aircraft = AM4Db.Plane & AircraftWithAmount;
type AircraftWithStaff = Pick<AM4Db.Plane, "staff"> & AircraftWithAmount;

interface ProfitOptions {
    fuelPrice?: number;
    co2Price?: number;
    activity?: number;
    gameMode: AM4.GameMode;
    reputation: {
        pax: number;
        cargo: number;
    };
    salaries?: {
        pilot: number;
        crew: number;
        engineer: number;
        tech: number;
    };
}

interface AllianceMember { 
    readonly member?: Member;
    readonly status: Status["status"];
}

const AM4BaseUrl = "https://www.airline4.net/api";

/**
 * Represents an airline
 * @constructor
 * @param data - The raw API data of the airline
 * @param client - The AM4 client that was used
 * @param airlineID - The ID this airline was searched with
 */

export default class Airline extends Status {
    protected _user: AM4.Airline["user"];
    protected _share_development: AM4.Airline["share_development"];
    protected _awards: AM4.Airline["awards"];
    protected _fleet: AM4.Airline["fleet"];
    public readonly airline?: {
        id?: number;
        name: string;
        rank: number;
        alliance?: {
            name: string,
            fetch(): Promise<Alliance>,
            fetchMember(): Promise<AllianceMember>
        };
        level: number;
        achievements: number;
        online: boolean;
        readonly gameMode: AM4.GameMode;
        readonly displayLogoURL: string;
        readonly founded: Date;
        logo?: string;
        reputation: {
            cargo: number;
            pax: number;
        }
    }
    public readonly fleet?: {
        size: number;
        routes: number;
        planes: Array<{ 
            name: string;
            amount: number;
        }>;
    }
    public readonly ipo?: {
        readonly has: boolean;
        currentValue: number;
        shares: {
            available: number;
            sold: number;
            total: number;
        };
        growth: Array<{
            value: number;
            date: Date;
        }>;
    }
    public readonly awards?: Array<{
        name: string;
        date: Date;
    }>;
    constructor({ user, awards, fleet, share_development, status }: AM4.Airline, protected client: AM4Client, airlineID?: number) {
        super(status, client.accessToken);
        Object.defineProperties(this, {
            "_user": {
                value: user,
                writable: true,
                configurable: true
            },
            "_fleet": {
                value: fleet,
                writable: true,
                configurable: true
            },
            "_awards": {
                value: awards,
                writable: true,
                configurable: true
            },
            "_share_development": {
                value: share_development,
                writable: true,
                configurable: true
            }
        });
        if (this.status.success) {
            this.airline = {
                name: user.company,
                rank: user.rank,
                level: user.level,
                achievements: user.achievements,
                online: Boolean(user.online),
                gameMode: user.game_mode,
                founded: new Date(user.founded * 1000),
                displayLogoURL: user.logo ? user.logo.split(' ')[0] : Airline.defaultLogoURL,
                reputation: {
                    cargo: user.cargo_reputation,
                    pax: user.reputation
                }
            }
            if (airlineID) this.airline.id = airlineID;
            if (user.logo) this.airline.logo = user.logo.split(' ')[0];
            if (user.alliance) this.airline.alliance = {
                name: user.alliance,
                async fetch() {
                    const query = new URLSearchParams({
                        access_token: client.accessToken,
                        search: user.alliance
                    });
                    const response = await fetch(`${AM4BaseUrl}?${query}`).then(res => res.json()) as AM4.Alliance;
                    if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
                    return new Alliance(response, client);
                },
                async fetchMember() {
                    const query = new URLSearchParams({
                        access_token: client.accessToken,
                        search: user.alliance
                    });
                    const response = await fetch(`${AM4BaseUrl}?${query}`).then(res => res.json()) as AM4.Alliance;
                    if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
                    const { members, status } = new Alliance(response, client);
                    if (!status.success) return { status };
                    return { member: members.get(user.company), status };
                }
            };
            this.fleet = {
                size: user.fleet,
                routes: user.routes,
                planes: fleet.map(({ aircraft: name, amount }) => ({ name, amount }))
            }
            this.ipo = {
                has: Boolean(user.ipo),
                currentValue: user.share,
                shares: {
                    available: user.shares_available,
                    sold: user.shares_sold,
                    total: user.shares_available + user.shares_sold
                },
                growth: share_development.map(({ share: shareValue, date }) => ({
                    date: new Date(date * 1000),
                    value: shareValue
                }))
            }
            this.awards = awards.map(({ award: awardName, awarded }) => ({
                date: new Date(awarded * 1000),
                name: awardName
            }));
        }
    }

    /**
     * Calculates the profit of the airline and all the invidual planes
     * @param planes - The plane data of the airline
     * @param options - The profit calculation options
     * @returns The income, expenses and final profit
     */

    static profit(planes: Aircraft[], { reputation, ...options }: ProfitOptions) {
        const fleet = planes.map(plane => {
            const type = plane.type === "cargo" ? plane.type : "pax";
            const { profit, income, expenses } = Plane.profit(plane, {
                ...options,
                reputation: reputation[type]
            });
            return {
                name: plane.name,
                amount: plane.amount,
                profit: profit * plane.amount,
                expenses: expenses * plane.amount,
                income: income * plane.amount
            }
        });
        return {
            fleet: fleet,
            airline: {
                profit: fleet.map(plane => plane.profit).reduce((a, b) => a + b),
                expenses: fleet.map(plane => plane.expenses).reduce((a, b) => a + b),
                income: fleet.map(plane => plane.income).reduce((a, b) => a + b)
            }
        }
    }

    /**
     * Calculates the total staff of the airline
     * @param planes - The plane data of the airline
     * @returns The amount of pilots, crew, engineers and technicians
     */

    static calculateStaff = (planes: AircraftWithStaff[]) => ({
        pilots: planes.map(aircraft => aircraft.staff.pilots * aircraft.amount).reduce((a, b) => a + b),
        crew: planes.map(aircraft => aircraft.staff.crew * aircraft.amount).reduce((a, b) => a + b),
        engineers: planes.map(aircraft => aircraft.staff.engineers * aircraft.amount).reduce((a, b) => a + b),
        tech: planes.map(aircraft => aircraft.staff.tech * aircraft.amount).reduce((a, b) => a + b)
    })

    /**
     * Calculate the estimated share value growth of an airline
     * @param planes - The raw plane data array with the plane amount
     * @param options - The options for the calculation
     * @returns The estimated share value growth per day
     */

    static estimatedShareValueGrowth(planes: Aircraft[], { reputation, ...options }: ProfitOptions) {
        const growth = planes.map(plane => {
            const type = plane.type === "cargo" ? plane.type : "pax";
            const daily = Plane.estimatedShareValueGrowth(plane, { 
                ...options, 
                reputation: reputation[type] 
            });
            return daily * plane.amount;
        });
        const estimated = growth.length && growth.reduce((a, b) => a + b);
        return estimated;
    }

    /**
     * The default logo for an airline
     */

    static readonly defaultLogoURL = "https://i.ibb.co/0JMbPBM/am-logo.png";

}