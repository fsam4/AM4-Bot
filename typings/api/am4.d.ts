interface Request {
    status: {
        request: 'failed' | 'success';
        requests_remaining: number;
        description?: string;
    };
}

export interface Airline extends Request {
    user: {
        company: string;
        level: number;
        online: number;
        share: number;
        shares_available: number;
        shares_sold: number;
        ipo: number;
        fleet: number;
        routes: number;
        alliance: string;
        achievements: number;
        game_mode: 'Realism' | 'Easy';
        rank: number;
        reputation: number;
        cargo_reputation: number;
        founded: number;
        logo: string;
    };
    share_development: Array<{
        date: number;
        share: number;
    }>;
    awards: Array<{
        award: string;
        awarded: number;
    }>;
    fleet: Array<{
        aircraft: string;
        amount: number;
    }>;
}

export interface Alliance extends Request {
    alliance: [
        {
            name: string;
            rank: number;
            members: number;
            maxMembers: number;
            value: number;
            ipo: number;
            minSV: number;
        }
    ];
    members: Array<{
        company: string;
        joined: number;
        flights: number;
        contributed: number;
        dailyContribution: number;
        online: number;
        shareValue: number;
        season?: number;
    }>;
}

export interface Route extends Request {
    route: {
        distance: number;
        departure: string;
        arrival: string;
    }
    demand: {
        economy_class_demand: number;
        business_class_demand: number;
        first_class_demand: number;
        cargo_large_demand: number;
        cargo_heavy_demand: number;
    }
}

export interface Routes extends Request {
    route: {
        departure: string;
        data: Array<{
            arrival: string;
            icao: string;
            iata: string;
            runway: number;
            market: number;
            economy_class_demand: number;
            business_class_demand: number;
            first_class_demand: number;
            cargo_large_demand: number;
            cargo_heavy_demand: number;
            distance: number;
        }>;
    }
}