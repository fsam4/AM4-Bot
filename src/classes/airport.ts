import Status from './status';

import type { Airports } from '@typings/api/tools';

/**
 * Represents an airport
 * @constructor
 * @param {Tools.airports} data - The raw API data of the airport
 */

export default class Airport extends Status {
    public readonly airports: Array<{
        id: number;
        city: string;
        country: string;
        country_code: string;
        market: number;
        runway: number;
        icao: string;
        iata: string;
        gps: {
            longitude: number;
            latitude: number;
        }
    }>;
    constructor({ request, airports }: Airports) {
        super(request);
        if (this.status.success) {
            this.airports = airports.map(airport => ({
                id: airport.id,
                city: airport.city,
                country: airport.country,
                country_code: airport.country_code.toUpperCase(),
                market: airport.market,
                runway: airport.runway,
                icao: airport.icao,
                iata: airport.iata,
                gps: {
                    longitude: Number(airport.longitude),
                    latitude: Number(airport.latitude)
                }
            }));
        }
    }
}