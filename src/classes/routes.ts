import Plane from '../lib/plane';
import Status from './status';
import Route from './route';

import type * as AM4 from '@typings/api/am4';

interface FlightTime {
    hours: number;
    minutes: number;
    seconds: number;
}

type CargoLoadType = "L" | "H";
type PaxSeatType = "Y" | "J" | "F";
type SeatType = CargoLoadType | PaxSeatType;

/**
 * Represents a route research result
 * @constructor
 * @param data - The raw API data of the routes
 */

export default class Routes extends Status {
    protected _route: AM4.Routes["route"];
    public readonly departure?: string;
    public readonly routes?: Array<{
        readonly route: {
            departure: string;
            arrival: string;
            icao: string;
            iata: string;
            market: number;
            runway: number;
            distance: number;
            flights: (speed: number, activity: number) => number;
            flightTime: (speed: number) => {
                hours: number;
                minutes: number;
                seconds: number;
                format: (this: FlightTime, format: string) => string;
            }
        }
        readonly demand: {
            F: number;
            J: number;
            Y: number;
            L: number;
            H: number;
            total: {
                pax: number;
                cargo: number;
            }
        },
        readonly ticket: {
            easy: {
                default: Record<SeatType, number>;
                vip: Record<SeatType, number>;
            }
            realism: {
                default: Record<SeatType, number>;
                vip: Record<SeatType, number>;
            }
        }
    }>;
    constructor({ status, route }: AM4.Routes) {
        super(status);
        this._route = route;
        if (this.status.success) {
            this.departure = route.departure
            this.routes = route.data.map(r => ({
                route: {
                    departure: route.departure,
                    arrival: r.arrival,
                    icao: r.icao,
                    iata: r.iata,
                    market: r.market,
                    runway: r.runway,
                    distance: r.distance,
                    flights: (...args) => Route.flights(r.distance, ...args),
                    flightTime: (speed) => Route.flightTime(r.distance, speed)
                },
                demand: {
                    F: r.first_class_demand,
                    J: r.business_class_demand,
                    Y: r.economy_class_demand,
                    L: r.cargo_large_demand * 1000,
                    H: r.cargo_heavy_demand * 1000,
                    total: {
                        pax: r.first_class_demand * 3 + r.business_class_demand * 2 + r.economy_class_demand,
                        cargo: Math.round(r.cargo_heavy_demand * 1000 + Plane.largeToHeavy(r.cargo_large_demand * 1000))
                    }
                },
                ticket: {
                    easy: {
                        default: Route.ticket(r.distance, 'easy'),
                        vip: Route.ticket(r.distance, 'easy', true)
                    },
                    realism: {
                        default: Route.ticket(r.distance, 'realism'),
                        vip: Route.ticket(r.distance, 'realism', true)
                    }
                }
            }))
        }
    }
}