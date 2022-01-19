import Status from './status';

import type * as Tools from '@typings/api/tools';

/**
 * Represents a stopover
 * @constructor
 * @param data - The raw API data of the stopover
 */

export default class Stopover extends Status {
    public readonly route: {
        distance: number;
        demand: Record<"Y" | "J" | "F" | "L" | "H", number>;
        departure: {
            id: number;
            iata: string;
            icao: string;
            runway: number;
            market: number;
            longitude: number;
            latitude: number;
            city: string;
            country: string;
            country_code: string;
        };
        arrival: {
            id: number;
            iata: string;
            icao: string;
            runway: number;
            market: number;
            longitude: number;
            latitude: number;
            city: string;
            country: string;
            country_code: string;
        };
    }
    public readonly stopover: {
        realism: (Tools.airport & { difference: number }) | string,
        easy: (Tools.airport & { difference: number }) | string
    }
    constructor({ request, stopover, routes }: Tools.Stopover) {
        super(request);
        if (this.status.success) {
            const [route] = routes;
            this.route = {
                distance: route.distance,
                departure: route.departure,
                arrival: route.arrival,
                demand: {
                    Y: route.economic_demand,
                    J: route.business_demand,
                    F: route.first_class_demand,
                    L: route.large_demand,
                    H: route.heavy_demand
                }
            }
            this.stopover = {
                realism: typeof stopover.realism.airports === 'string' ? stopover.realism.airports : stopover.realism.airports[0],
                easy: typeof stopover.easy.airports === 'string' ? stopover.easy.airports : stopover.easy.airports[0]
            }
        }
    }
}