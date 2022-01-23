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
            this.routes = route.data.map(destination => ({
                route: {
                    departure: route.departure,
                    arrival: destination.arrival,
                    icao: destination.icao,
                    iata: destination.iata,
                    market: destination.market,
                    runway: destination.runway,
                    distance: destination.distance,
                    flights: (...args) => Route.flights(destination.distance, ...args),
                    flightTime: (speed) => Route.flightTime(destination.distance, speed)
                },
                demand: {
                    F: destination.first_class_demand,
                    J: destination.business_class_demand,
                    Y: destination.economy_class_demand,
                    L: destination.cargo_large_demand * 1000,
                    H: destination.cargo_heavy_demand * 1000,
                    total: {
                        pax: destination.first_class_demand * 3 + destination.business_class_demand * 2 + destination.economy_class_demand,
                        cargo: Math.round(destination.cargo_heavy_demand * 1000 + Plane.largeToHeavy(destination.cargo_large_demand * 1000))
                    }
                },
                ticket: {
                    easy: {
                        default: Route.ticket(destination.distance, 'easy'),
                        vip: Route.ticket(destination.distance, 'easy', true)
                    },
                    realism: {
                        default: Route.ticket(destination.distance, 'realism'),
                        vip: Route.ticket(destination.distance, 'realism', true)
                    }
                }
            }));
        }
    }
}