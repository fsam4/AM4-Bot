import Status from './status';

import type { Planes } from '@typings/api/tools';

/**
 * Represents an aircraft
 * @constructor
 * @param data - The raw API data of the aircraft
 */

export default class Aircraft extends Status {
    readonly aircrafts: Array<{
        model: string;
        type: 'pax' | 'cargo';
        manufacturer: string;
        capacity: number;
        runway: number;
        service_ceil: number;
        price: number;
        range: number;
        a_check: {
            price: number;
            time: number;
        }
        staff: {
            pilots: number;
            crew: number;
            engineers: number;
            tech: number;
        }
        engines: Array<{
            name: string;
            speed: number;
            fuel: number;
            co2: number;
        }>
    }>
    constructor({ request, ...response }: Planes) {
        super(request);
        if (this.status.success) {
            this.aircrafts = response.aircrafts.map(plane => ({
                model: plane.model,
                type: plane.type,
                manufacturer: plane.manufactory,
                capacity: plane.capacity,
                runway: plane.runway,
                service_ceil: plane.ceil,
                price: plane.price,
                range: plane.range,
                a_check: {
                    price: plane.a_check,
                    time: plane.maintenance
                },
                staff: {
                    pilots: plane.pilots,
                    crew: plane.crew,
                    engineers: plane.engineers,
                    tech: plane.tech
                },
                engines: plane.engines.map(function(engine) {
                    return {
                        name: engine.engine,
                        speed: engine.speed,
                        fuel: Number(engine.fuel),
                        co2: Number(engine.co2)
                    }
                })
            }))
        }
    }
}