type engine = {
    engine: string;
    speed: number;
    fuel: string;
    co2: string;
}

type airport = {
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
}

interface Request {
    request: {
        status: number;
        quotas?: number;
        error?: string;
    }
}

export interface Stopover extends Request {
    aircrafts: [
        {
            id: number;
            model: string;
            type: 'Pax' | 'Cargo';
            manufactory: string;
            shortname: string;
            capacity: number;
            runway: number;
            a_check: number;
            range: number;
            ceil: number;
            maintenance: number;
            price: number;
            pilots: number;
            crew: number;
            engineers: number;
            tech: number;
            thumb: string;
            active_engine: engine;
            engines: engine[];
        }
    ];
    routes: [
        {
            id: string;
            economic_demand: number;
            business_demand: number;
            first_class_demand: number;
            large_demand: number;
            heavy_demand: number;
            distance: number;
            departure: airport;
            arrival: airport;
        }
    ];
    stopover: {
        realism: {
            airports: [airport & { difference: number }] | "direct" | "route long for this aircraft";
            ticketL?: number;
            ticketH?: number;
            ticketY?: number;
            ticketJ: number;
            ticketF: number;
        },
        easy: {
            airports: [airport & { difference: number }] | "direct" | "route long for this aircraft";
            ticketL?: number;
            ticketH?: number;
            ticketY?: number;
            ticketJ: number;
            ticketF: number;
        }
    }
}

export interface Airports extends Request {
    airports: airport[];
}

export interface Routes extends Request {
    routes: {
        id: string;
        economic_demand: number;
        business_demand: number;
        first_class_demand: number;
        large_demand: number;
        heavy_demand: number;
        distance: number;
        departure: airport;
        arrival: airport;
    }[];
}

export interface Planes extends Request {
    aircrafts: Array<{
        id: number;
        model: string;
        type: "pax" | "cargo";
        manufactory_id: number;
        manufactory: string;
        capacity: number;
        runway: number;
        a_check: number;
        range: number;
        ceil: number;
        maintenance: number;
        price: number;
        pilots: number;
        crew: number;
        engineers: number;
        tech: number;
        thumb: string;
        active_engine: engine;
        engines: engine[];
    }>;
}