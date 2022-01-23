import Plane from '../lib/plane';
import Status from './status';
import Stopover from './stopover';
import Airport from './airport';
import fetch from 'node-fetch';

import type { AM4_Data } from '@typings/database';
import type * as Tools from '@typings/api/tools';
import type * as AM4 from '@typings/api/am4';
import type AM4Client from '@source/index';

type CargoLoadType = "L" | "H";
type PaxSeatType = "Y" | "J" | "F";
type SeatType = CargoLoadType | PaxSeatType;

type CargoConfiguration = Record<CargoLoadType, number>;
type PaxConfiguration = Record<PaxSeatType, number>;

interface ProfitOptions {
    options: {
        fuel_price: number;
        co2_price: number;
        activity: number;
        mode: 'realism' | 'easy';
        reputation: number;
    }
    route: {
        distance: number;
        flights: number;
        configuration: PaxConfiguration | CargoConfiguration;
    }
}

interface ConfigurationOptions {
    route: {
        distance: number;
        demand: {
            Y: number;
            J: number;
            F: number;
            L: number;
            H: number;
        };
    }
    options: {
        amount?: number;
        preference?: [CargoLoadType, CargoLoadType] | [PaxSeatType, PaxSeatType, PaxSeatType]
        reputation?: number;
        flights: number;
        activity: number;
        mode: 'realism' | 'easy';
    }
}

interface SearchQuery { 
    dep_icao: string;
    arr_icao: string; 
}

const toolsBaseUrl = "https://api.am4tools.com";

function padNumber(number: number, padding: number) {
    let str = number.toString();
    while (str.length < padding) str = '0' + str;
    return str;
}

/**
 * Represents a route
 * @constructor
 * @param route - The raw API data of the route
 * @param client - The AM4 client that was used
 * @param searchQuery - The given options for this route
 */

export default class Route extends Status {
    protected _route: AM4.Route["route"];
    protected _demand: AM4.Route["demand"];
    public readonly route?: {
        departure: {
            airport: string,
            fetch(): Promise<Airport>
        }
        arrival: {
            airport: string,
            fetch(): Promise<Airport>
        }
        distance: number;
        findStopover(plane: string, type: 'pax' | 'cargo'): Promise<Stopover>
    }
    public readonly demand?: Record<SeatType, number> & {
        total: {
            pax: number;
            cargo: number;
        }
    }
    public readonly ticket?: {
        easy: {
            default: Record<SeatType, number>;
            vip: Record<SeatType, number>;
        }
        realism: {
            default: Record<SeatType, number>;
            vip: Record<SeatType, number>;
        }
    }
    constructor({ status, route, demand }: AM4.Route, protected client: AM4Client, searchQuery: SearchQuery) {
        super(status);
        this._route = route;
        this._demand = demand;
        if (this.status.success) {
            this.route = {
                departure: {
                    airport: route.departure,
                    async fetch() {
                        if (!client.tools) throw new Error("Missing access key");
                        const query = new URLSearchParams({
                            mode: 'normal',
                            code: searchQuery.dep_icao
                        });
                        const response = await fetch(`${toolsBaseUrl}/airport/search?${query}`, {
                            headers: {
                                "x-access-token": this.tools.accessToken
                            }
                        });
                        const body: Tools.Airports = await response.json();
                        return new Airport(body);
                    }
                },
                arrival: {
                    airport: route.arrival,
                    async fetch() {
                        if (!client.tools) throw new Error("Missing access key");
                        const query = new URLSearchParams({
                            mode: 'normal',
                            code: searchQuery.arr_icao
                        });
                        const response = await fetch(`${toolsBaseUrl}/airport/search?${query}`, {
                            headers: {
                                "x-access-token": this.tools.accessToken
                            }
                        });
                        const body: Tools.Airports = await response.json();
                        return new Airport(body);
                    }
                },
                distance: route.distance,
                async findStopover(plane, type) {
                    if (!client.tools) throw new Error("Missing access key");
                    const query = new URLSearchParams({
                        type: type,
                        mode: 'normal', 
                        departure: searchQuery.dep_icao,
                        arrival: searchQuery.arr_icao,
                        model: plane
                    });
                    const response = await fetch(`${toolsBaseUrl}/route/stopover?${query}`, {
                        headers: {
                            "x-access-token": this.tools.accessToken
                        }
                    });
                    const body: Tools.Stopover = await response.json();
                    return new Stopover(body);
                }
            }
            this.demand = {
                F: demand.first_class_demand,
                J: demand.business_class_demand,
                Y: demand.economy_class_demand,
                L: demand.cargo_large_demand,
                H: demand.cargo_heavy_demand,
                total: {
                    pax: demand.economy_class_demand + demand.business_class_demand * 2 + demand.first_class_demand * 3,
                    cargo: Math.round(demand.cargo_heavy_demand + Plane.largeToHeavy(demand.cargo_large_demand))
                }
            },
            this.ticket = {
                easy: {
                    default: Route.ticket(route.distance, 'easy'),
                    vip: Route.ticket(route.distance, 'easy', true)
                },
                realism: {
                    default: Route.ticket(route.distance, 'realism'),
                    vip: Route.ticket(route.distance, 'realism', true)
                }
            }
        }
    }

    /**
     * Calculates the flights per day of a route
     * @param distance - The distance of the route
     * @param plane - The speed of the plane
     * @param activity - The activity time in hours
     * @returns The flights per day
     */

    static flights(distance: number, speed: number, activity = 18) {
        const flightTime = distance / speed;
        return Math.floor(activity / flightTime) + 1;
    }

    /**
     * Calculates the flight time of the route in seconds, minutes and hours
     * @param distance - The distance of the route
     * @param speed - The speed of the plane
     * @returns The flight time of the route
     */

    static flightTime(distance: number, speed: number) {
        const time = Math.round((distance / speed) * 3600)
        const remainder = time % 3600;
        interface FlightTime {
            hours: number;
            minutes: number;
            seconds: number;
        }
        return {
            hours: Math.trunc(time / 3600), 
            minutes: Math.trunc(remainder / 60), 
            seconds: Math.trunc(remainder % 60),

            /**
             * Formats the flight time to the give format.
             * For example giving format as "hh:mm:ss" will format it as "12:05:11"
             * @param format The format of the time. Use h for hours, m for minutes and s for seconds.
             * @returns The formatted time
             */

            format(this: FlightTime, format: string) {
                let formattedString = format;
                formattedString = formattedString
                .replace(/h{1,}/g, hourFormat => padNumber(this.hours, hourFormat.length))
                .replace(/m{1,}/g, minuteFormat => padNumber(this.minutes, minuteFormat.length))
                .replace(/s{1,}/g, secondFormat => padNumber(this.seconds, secondFormat.length));
                return formattedString;
            }
        };
    }

    /**
     * Calculates the best ticket prices for a route
     * @param distance - The distance of the route
     * @param mode - The game mode (easy or realism)
     * @param vip - Whether to use VIP ticket prices. Please note that these prices are experimental!
     * @returns The ticket prices of each class
     */

    static ticket(distance: number, mode: 'realism' | 'easy', vip?: boolean) {
        type TicketPrices = Record<"Y" | "J" | "F" | "L" | "H", number>;
        let ticket: TicketPrices = { Y: null, J: null, F: null, L: null, H: null };
        if (vip) {
            ticket.Y = ((Math.floor(((0.4 * distance) + 170) * 1.7489 * 1.22) / 10) * 10);
            ticket.J = ((Math.floor(((0.8 * distance) + 560) * 1.7489 * 1.20) / 10) * 10);
            ticket.F = ((Math.floor(((1.2 * distance) + 1200) * 1.7489 * 1.17) / 10) * 10);
        } else {
            switch(mode) {
                case "realism": {
                    ticket.Y = ((Math.floor(((0.3 * distance) + 150) * 1.10) / 10) * 10);
                    ticket.J = ((Math.floor(((0.6 * distance) + 500) * 1.08) / 10) * 10);
                    ticket.F = ((Math.floor(((0.9 * distance) + 1000) * 1.06) / 10) * 10);
                    break;
                }
                case "easy": {
                    ticket.Y = ((Math.floor(((0.4 * distance) + 170) * 1.10) / 10) * 10);
                    ticket.J = ((Math.floor(((0.8 * distance) + 560) * 1.08) / 10) * 10);
                    ticket.F = ((Math.floor(((1.2 * distance) + 1200) * 1.06) / 10) * 10);
                    break;
                }
            }
        }
        switch(mode) {
            case "realism": {
                ticket.L = (Math.floor((((((0.000776321822039374 * distance) + 0.860567600367807000) - 0.01) * 1.10)) * 100) / 100);
                ticket.H = (Math.floor((((((0.000517742799409248 * distance) + 0.256369915396414000) - 0.01) * 1.08)) * 100) / 100);
                break;
            }
            case "easy": {
                ticket.L = (Math.floor((((((0.000948283724581252 * distance) + 0.862045432642377000) - 0.01) * 1.10)) * 100) / 100);
                ticket.H = (Math.floor((((((0.000689663577640275 * distance) + 0.292981124272893000) - 0.01) * 1.08)) * 100) / 100);
                break;
            }
        }
        return ticket;
    }

    /**
     * Calculates the precise total distance between all the airports.
     * Use `Route.distance()` for AM4 distances.
     * @param gps - The gps locations of each airports
     * @returns The total distance in kilometers with the distances of each leg as well
     * @copyright Prestige Wings
     */

    static preciseDistance(...gps: Array<{ longitude: number, latitude: number }>) {
        if (gps.length < 2) throw new Error('Atleast 2 locations have to be provided for distance calculations...');
        let i = 0, distance = 0, distances: number[] = [];
        const R = 6371 * (Math.pow(10, 3));
        while(i < gps.length) {
            const dep = gps[i++], arr = gps[i];
            if(!dep || !arr) break;
            dep.latitude *= (Math.PI / 180);
            dep.longitude *= (Math.PI / 180);
            arr.latitude *= (Math.PI / 180);
            arr.longitude *= (Math.PI / 180);
            const y = arr.latitude - dep.latitude;
            const dlamb = arr.longitude - dep.longitude;
            const x = dlamb * Math.cos((dep.latitude + arr.latitude) / 2);
            const d = R * Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            distance += d;
            distances.push(d);
        }
        return {
            distance: Math.round(distance / 1000),
            distances: distances.map(d => Math.round(d / 1000))
        }
    }

    /**
     * Calculates the distance between all the airports. Use this to get accurate AM4 distances.
     * @param gps - The gps locations of each airports
     * @returns The total distance in kilometers with the distances of each leg as well
     * @copyright Prestige Wings
     */

    static distance(...gps: Array<{ longitude: number, latitude: number }>) {
        if (gps.length < 2) throw new Error('Atleast 2 locations have to be provided for distance calculations...');
        let i = 0, distance = 0, distances: number[] = [];
        const R = 6371 * (Math.pow(10, 3));
        while(i < gps.length) {
            const dep = gps[i++], arr = gps[i];
            if (!dep || !arr) break;
            dep.latitude *= (Math.PI / 180);
            dep.longitude *= (Math.PI / 180);
            arr.latitude *= (Math.PI / 180);
            arr.longitude *= (Math.PI / 180);
            const dlamb = arr.longitude - dep.longitude;
            const d = R * Math.acos(Math.sin(dep.latitude) * Math.sin(arr.latitude) + Math.cos(dep.latitude) * Math.cos(arr.latitude) * Math.cos(dlamb));
            distance += d;
            distances.push(d);
        }
        return {
            distance: Math.round(distance / 1000),
            distances: distances.map(d => Math.round(d / 1000))
        };
    }

    /**
     * Calculates the best possible configuration for the specified route with the specified plane.
     * @param plane - The plane to use on this route
     * @param options - The configuration options for this route
     * @returns The configuration of each class
     */

    static configure(plane: AM4_Data.plane, { route, options }: ConfigurationOptions) {
        const change = options.reputation ? ((100 + (100 - options.reputation)) / 100) : 1;
        let capacity = plane.capacity, configuration = { Y: 0, J: 0, F: 0, H: 0, L: 0 };
        const maxDemand =  { 
            F: Math.round((route.demand.F * change / options.flights) * 3),
            J: Math.round((route.demand.J * change / options.flights) * 2),
            Y: Math.round(route.demand.Y * change / options.flights),
            H: Math.round(route.demand.H * change / options.flights),
            L: Math.round(Plane.largeToHeavy(route.demand.L * change / options.flights))
        };
        if (plane.type === "cargo") {
            options.preference ||= [ 'L', 'H' ];
            for (const type of options.preference) {
                if (capacity <= 0) break;
                if (capacity > maxDemand[type] && type !== options.preference[1]) {
                    configuration[type] = maxDemand[type];
                    capacity -= maxDemand[type]
                    continue;
                } else {
                    configuration[type] = capacity
                    break;
                }
            }
            configuration.L = Plane.heavyToLarge(configuration.L);
        } else {
            if (!options.preference) {
                options.preference = [ 'F', 'J', 'Y' ];
                switch(options.mode) {
                    case 'realism':
                        if (route.distance > 13889) options.preference = [ 'J', 'F', 'Y' ];
                        if (route.distance > 15694) options.preference = [ 'J', 'Y', 'F' ];
                        if (route.distance > 17500) options.preference = [ 'Y', 'J', 'F' ];
                        break;
                    case 'easy': 
                        if (route.distance > 14425) options.preference = [ 'F', 'Y', 'J' ];
                        if (route.distance > 14812) options.preference = [ 'Y', 'F', 'J' ];
                        if (route.distance > 15200) options.preference = [ 'Y', 'J', 'F' ];
                        break;
                }
            }
            for (const type of options.preference) {
                if (capacity <= 0) break;
                if (capacity > maxDemand[type] && type !== options.preference[2]) {
                    configuration[type] = maxDemand[type];
                    capacity -= maxDemand[type];
                    continue;
                } else {
                    configuration[type] = capacity;
                    break;
                }
            }
            configuration.J = Math.trunc(configuration.J / 2);
            configuration.F = Math.trunc(configuration.F / 3);
            const seatsLeft = plane.capacity - (configuration.Y + configuration.J * 2 + configuration.F * 3);
            if (seatsLeft) {
                if (seatsLeft % 3 === 0) {
                    configuration.F += seatsLeft / 3;
                } else if (seatsLeft % 2 === 0) {
                    configuration.J += seatsLeft / 2;
                } else {
                    configuration.Y += seatsLeft;
                }
            }
        }
        return {
            configuration,
            preference: options.preference
        }
    }

    /**
     * Calculates the profit of a given route with a given plane
     * @param plane - The plane to use on this route
     * @param options - The calculation options 
     * @returns The income, expenses and final profit of the route
     */
        
    static profit(plane: AM4_Data.plane, { route, options }: ProfitOptions) {
        options.fuel_price ??= 500;
        options.co2_price ??= 125;
        options.activity ||= 18;
        options.reputation ||= 100;
        const { distance, flights, configuration } = route;
        const change = options.reputation / 100;
        const A_checkExpenses = plane.A_check.price / plane.A_check.time * options.activity;
        const fuelExpenses = (distance * plane.fuel * (options.fuel_price / 1000)) * flights;
        const ticket = Route.ticket(distance, options.mode, plane.type === "vip");
        let income: number, expenses: number;
        if (plane.type === "cargo") {
            const config = {
                L: configuration['L'] * change,
                H: configuration['H'] * change
            }
            income = ((config.L * ticket.L) + (config.H * ticket.H)) * flights;
            const co2_expenses = ((plane.co2 * distance * (plane.capacity / 500)) * (options.co2_price / 1000)) * flights;
            expenses = A_checkExpenses + fuelExpenses + co2_expenses;
        } else {
            const config = {
                Y: Math.trunc(configuration['Y'] * change),
                J: Math.trunc(configuration['J'] * change),
                F: Math.trunc(configuration['F'] * change)
            }
            income = ((config.Y * ticket.Y) + (config.J * ticket.J) + (config.F * ticket.F)) * flights;
            const co2_expenses = ((plane.co2 * distance * plane.capacity) * (options.co2_price / 1000)) * flights;
            expenses = A_checkExpenses + fuelExpenses + co2_expenses;
        }
        return { 
            profit: Math.round(income - expenses), 
            income: Math.round(income), 
            expenses: Math.round(expenses)
        }
    }

    /**
     * A function for calculating the estimted SV growth per day for a route
     * @param plane The raw plane data
     * @param income The total income of the plane (per day)
     * @param options The options for the calculation
     * @returns The estimated SV growth per day for the route
     */

    static estimatedShareValueGrowth(plane: AM4_Data.plane, options: ProfitOptions) {
        const { income, expenses } = Route.profit(plane, options);
        const decrease = expenses / 40000000;
        const growth = income / 40000000;
        return growth - decrease;
    }
}