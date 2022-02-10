import defaultSettings from '../settings.json';
import Status from './status';
import Plane from '../lib/plane';

import type { AM4 as AM4Db } from '@typings/database';
import type AM4Client from '@source/index';
import type * as AM4 from '@typings/am4-api';

type CargoLoadType = "L" | "H";
type PaxSeatType = "Y" | "J" | "F";
type SeatType = CargoLoadType | PaxSeatType;

type CargoConfiguration = Record<CargoLoadType, number>;
type PaxConfiguration = Record<PaxSeatType, number>;

type Coordinates = [number, number];

interface ProfitOptions {
    route: {
        distance: number;
        flights: number;
        configuration: PaxConfiguration | CargoConfiguration;
    };
    options: {
        fuelPrice?: number;
        co2Price?: number;
        activity?: number;
        gameMode: AM4.GameMode;
        reputation?: number;
    };
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
        preference?: [CargoLoadType, CargoLoadType] | [PaxSeatType, PaxSeatType, PaxSeatType];
        reputation?: number;
        flights: number;
        activity?: number;
        gameMode: AM4.GameMode;
    }
}

const R = 6371 * (Math.pow(10, 3));

function padNumber(number: number, padding: number) {
    let str = number.toString();
    while (str.length < padding) str = '0' + str;
    return str;
}

/**
 * Represents a route
 * @constructor
 * @param route - The raw API data of the route
 * @param client - The AM4 rest client that was used
 */

export default class Route extends Status {
    protected _route: AM4.Route["route"];
    protected _demand: AM4.Route["demand"];
    public readonly route?: {
        departure: string;
        arrival: string;
        distance: number;
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
    constructor({ status, route, demand }: AM4.Route, protected client: AM4Client) {
        super(status);
        this._route = route;
        this._demand = demand;
        if (this.status.success) {
            this.route = {
                departure: route.departure,
                arrival: route.arrival,
                distance: route.distance
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
                    default: Route.ticket(route.distance, "Easy"),
                    vip: Route.ticket(route.distance, "Easy", true)
                },
                realism: {
                    default: Route.ticket(route.distance, "Realism"),
                    vip: Route.ticket(route.distance, "Realism", true)
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

    static flights(distance: number, speed: number, activity = defaultSettings.activity) {
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
        const flightTime = {
            hours: Math.trunc(time / 3600), 
            minutes: Math.trunc(remainder / 60), 
            seconds: Math.trunc(remainder % 60),
        };
        return {
            ...flightTime,

            /**
             * Formats the flight time to the give format.
             * For example giving format as "hh:mm:ss" will format it as "12:05:11"
             * @param format The format of the time. Use h for hours, m for minutes and s for seconds.
             * @returns The formatted time
             */

            format(this: typeof flightTime, format: string) {
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
     * @param vip - Whether to use VIP ticket prices, by default false. Please note that these prices are experimental!
     * @returns The ticket prices of each class
     */

    static ticket(distance: number, mode: AM4.GameMode, vip = false) {
        type TicketPrices = Record<"Y" | "J" | "F" | "L" | "H", number>;
        let ticket: TicketPrices = { Y: null, J: null, F: null, L: null, H: null };
        if (vip) {
            ticket.Y = ((Math.floor(((0.4 * distance) + 170) * 1.7489 * 1.22) / 10) * 10);
            ticket.J = ((Math.floor(((0.8 * distance) + 560) * 1.7489 * 1.20) / 10) * 10);
            ticket.F = ((Math.floor(((1.2 * distance) + 1200) * 1.7489 * 1.17) / 10) * 10);
        } else {
            switch(mode) {
                case "Realism": {
                    ticket.Y = ((Math.floor(((0.3 * distance) + 150) * 1.10) / 10) * 10);
                    ticket.J = ((Math.floor(((0.6 * distance) + 500) * 1.08) / 10) * 10);
                    ticket.F = ((Math.floor(((0.9 * distance) + 1000) * 1.06) / 10) * 10);
                    break;
                }
                case "Easy": {
                    ticket.Y = ((Math.floor(((0.4 * distance) + 170) * 1.10) / 10) * 10);
                    ticket.J = ((Math.floor(((0.8 * distance) + 560) * 1.08) / 10) * 10);
                    ticket.F = ((Math.floor(((1.2 * distance) + 1200) * 1.06) / 10) * 10);
                    break;
                }
            }
        }
        switch(mode) {
            case "Realism": {
                ticket.L = (Math.floor((((((0.000776321822039374 * distance) + 0.860567600367807000) - 0.01) * 1.10)) * 100) / 100);
                ticket.H = (Math.floor((((((0.000517742799409248 * distance) + 0.256369915396414000) - 0.01) * 1.08)) * 100) / 100);
                break;
            }
            case "Easy": {
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

    static preciseDistance(...gps: [departure: Coordinates, second: Coordinates, ...rest: Coordinates[]]) {
        if (gps.length < 2) throw new Error('Atleast 2 locations have to be provided for distance calculations...');
        let i = 0, distance = 0, distances: number[] = [];
        while(i < gps.length) {
            const dep = gps[i++], arr = gps[i];
            if(!dep || !arr) break;
            const depLat = dep[1] * (Math.PI / 180);
            const depLon = dep[0] * (Math.PI / 180);
            const arrLat = arr[1] * (Math.PI / 180);
            const arrLon = arr[0] * (Math.PI / 180);
            const y = arrLat - depLat;
            const dlamb = arrLon - depLon;
            const x = dlamb * Math.cos((depLat + arrLat) / 2);
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

    static distance(...gps: [departure: Coordinates, second: Coordinates, ...rest: Coordinates[]]) {
        if (gps.length < 2) throw new Error('Atleast 2 locations have to be provided for distance calculations...');
        let i = 0, distance = 0, distances: number[] = [];
        while(i < gps.length) {
            const dep = gps[i++], arr = gps[i];
            if (!dep || !arr) break;
            const depLat = dep[1] * (Math.PI / 180);
            const depLon = dep[0] * (Math.PI / 180);
            const arrLat = arr[1] * (Math.PI / 180);
            const arrLon = arr[0] * (Math.PI / 180);
            const dlamb = arrLon - depLon;
            const d = R * Math.acos(Math.sin(depLat) * Math.sin(arrLat) + Math.cos(depLat) * Math.cos(arrLat) * Math.cos(dlamb));
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

    static configure(plane: AM4Db.Plane, { route, options }: ConfigurationOptions) {
        options.activity ??= defaultSettings.activity;
        options.reputation ??= defaultSettings.reputation;
        const change = (100 + (100 - options.reputation)) / 100;
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
                switch(options.gameMode) {
                    case "Realism":
                        if (route.distance > 13889) options.preference = [ 'J', 'F', 'Y' ];
                        if (route.distance > 15694) options.preference = [ 'J', 'Y', 'F' ];
                        if (route.distance > 17500) options.preference = [ 'Y', 'J', 'F' ];
                        break;
                    case "Easy": 
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
        
    static profit(plane: AM4Db.Plane, { route, options }: ProfitOptions) {
        options.fuelPrice ??= defaultSettings.fuelPrice;
        options.co2Price ??= defaultSettings.co2Price;
        options.activity ??= defaultSettings.activity;
        options.reputation ??= defaultSettings.reputation;
        const { distance, flights, configuration } = route;
        const change = options.reputation / 100;
        const A_checkExpenses = plane.A_check.price / plane.A_check.time * options.activity;
        const fuelExpenses = (distance * plane.fuel * (options.fuelPrice / 1000)) * flights;
        const ticket = Route.ticket(distance, options.gameMode, plane.type === "vip");
        let income: number, expenses: number;
        if (plane.type === "cargo") {
            const config = {
                L: configuration['L'] * change,
                H: configuration['H'] * change
            }
            income = ((config.L * ticket.L) + (config.H * ticket.H)) * flights;
            const co2_expenses = ((plane.co2 * distance * (plane.capacity / 500)) * (options.co2Price / 1000)) * flights;
            expenses = A_checkExpenses + fuelExpenses + co2_expenses;
        } else {
            const config = {
                Y: Math.trunc(configuration['Y'] * change),
                J: Math.trunc(configuration['J'] * change),
                F: Math.trunc(configuration['F'] * change)
            }
            income = ((config.Y * ticket.Y) + (config.J * ticket.J) + (config.F * ticket.F)) * flights;
            const co2_expenses = ((plane.co2 * distance * plane.capacity) * (options.co2Price / 1000)) * flights;
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

    static estimatedShareValueGrowth(plane: AM4Db.Plane, options: ProfitOptions) {
        const { income, expenses } = Route.profit(plane, options);
        const decrease = expenses / 40000000;
        const growth = income / 40000000;
        return growth - decrease;
    }

    /**
     * A function for filtering all possible stopovers from an array of airports
     * @param route An array of the route's airports (in order from departure to arrival and stopovers inbetween, if the route has any yet)
     * @param airports The airports to filter the stopover from. Recommended to prefilter useless airports out to increase the speed.
     * @param plane The plane to use on the route
     * @param amount The amount of stopovers to add to the route, by default 1. This algorithm scales pretty quickly so be careful!
     * @returns All possible stopovers out of the given airports
     */

    static filterStopovers(route: AM4Db.Airport[], airports: AM4Db.Airport[], plane: AM4Db.Plane, amount = 1) {
        const stopovers: Array<{ distance: number, airports: AM4Db.Airport[] }> = [];
        for (const airport of airports) {
            const currentRoute = [...route];
            const destination = currentRoute.pop();
            currentRoute.push(airport, destination);
            type Locations = Parameters<typeof Route.distance>;
            const locations = currentRoute.map(airport => airport.location.coordinates);
            const { distances, distance } = Route.distance(...locations as Locations);
            if (distances.some(distance => distance > plane.range)) continue;
            if (amount > 1) {
                const availableAirports = airports.filter(({ _id: airportID }) => !airportID.equals(airport._id));
                const stopoverCombinations = Route.filterStopovers(currentRoute, availableAirports, plane, amount - 1);
                stopovers.push(...stopoverCombinations);
            } else {
                stopovers.push({
                    distance,
                    airports: currentRoute
                });
            }
        }
        return stopovers;
    }

    /**
     * A function for finding the best stopovers for a route
     * @param route An array of the route's airports (in order from departure to arrival and stopovers inbetween, if the route has any yet)
     * @param airports The airports to filter the stopover from. Recommended to prefilter useless airports out to increase the speed.
     * @param plane The plane to use on the route
     * @param mode The game mode to use for the calculations
     * @param amount The amount of stopovers to add to the route, by default 1. This algorithm scales pretty quickly so be careful!
     * @returns An array of the stopovers from best to worst with the new route distance and an array of the route's airports in order from departure to arrival
     */

    static findStopovers(route: AM4Db.Airport[], airports: AM4Db.Airport[], plane: AM4Db.Plane, mode: AM4.GameMode, amount?: number) {
        if (mode === "Realism") airports = airports.filter(airport => airport.runway >= plane.runway);
        const locations = route.map(airport => airport.location.coordinates);
        type Locations = Parameters<typeof Route.distance>;
        const { distances, distance } = Route.distance(...locations as Locations);
        if (distances.length > 1 ? distances.some(distance => distance > plane.range) : (distance > (plane.range * 2))) return [];
        const stopovers = Route.filterStopovers(route, airports, plane, amount);
        stopovers.sort((a, b) => a.distance - b.distance);
        return stopovers;
    }

}