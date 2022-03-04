import type { Binary, ObjectId } from "bson";
import type { GameMode } from "@typings/am4-api";

type PaxSeat = 'Y' | 'J' | 'F';
type CargoLoad = 'H' | 'L';

interface BaseDocument {
    _id?: ObjectId;
}

interface LocationDocument {
    location: {
        type: "Point";
        coordinates: [number, number];
    };
}

type Project<T extends Record<keyof P, any>, P> = {
    [Property in keyof P as P[Property] extends false ? never : Property]: T[Property];
};

type GeoNear<T> = T & {
    dist: LocationDocument & { 
        calculated: number; 
    };
};

type LogValue = { 
    value: number; 
    date: Date;
};

export namespace AM4 {
    
    interface Achievement extends BaseDocument {
        name: string;
        description?: string;
        bonus_points: number;
        route: ObjectId[];
        icon: Binary;
        hint: string;
        image?: string;
    }

    interface Airport extends BaseDocument, LocationDocument {
        city: string;
        country: string;
        country_code: string;
        market: number;
        runway: number;
        icao: string;
        iata: string;
    }

    interface Alliance extends BaseDocument {
        name: string;
        archived?: true;
        values: LogValue[];
    }

    interface AllianceMember extends BaseDocument {
        name: string;
        allianceID: ObjectId;
        joined: Date;
        flights: number;
        contribution: number;
        shareValue: LogValue[];
        offline: LogValue[];
        dailyContribution: LogValue[];
        expireAt: Date;
    }

    interface Plane extends BaseDocument {
        name: string;
        price?: number;
        bonus_points?: number;
        speed: number;
        range: number;
        runway: number;
        capacity: number;
        type: "pax" | "cargo" | "vip";
        image: Binary;
        fuel: number;
        co2: number;
        manufacturer: {
            name: string;
            icon: string;
        };
        A_check: {
            price: number;
            time: number;
        };
        staff: {
            pilots: number;
            crew: number;
            engineers: number;
            tech: number;
        };
        engines: Array<{
            name: string;
            fuel: number;
            speed: number;
        }>;
    }

    interface Route extends BaseDocument {
        airports: [ObjectId, ObjectId];
        demand: {
            Y: number,
            J: number,
            F: number,
            L: number,
            H: number
        };
    }

}

type AdminLevel = 0 | 1 | 2 | 3 | 4 | 5;

export namespace Discord {

    interface User extends BaseDocument {
        id: string;
        name?: string;
        airlineID?: number;
        admin_level: AdminLevel;
        notifications_made: number;
        mute?: Date;
        commands: Array<{
            command: string;
            uses: number;
        }>;
        warnings: Array<{
            date: Date;
            reason: string;
        }>;
    }

    interface Notification extends BaseDocument {
        date: Date;
        user: string;
        server: string;
        expireAt: Date;
        edited?: Date;
        prices: {
            fuel: number;
            co2: number;
        };
        webhooks: Array<{
            id: ObjectId;
            channel: string;
            server: string;
            message: string;
        }>;
    }

    interface Panel extends BaseDocument {
        type: "message" | "panel";
        author: string;
        server: string;
        channel: string;
        message: string;
        reactions?: Array<{
            role: string;
            emoji: {
                name: string;
                id: string;
            };
        }>;
    }

    interface Giveaway extends BaseDocument {
        finished: boolean;
        author: string;
        server: string;
        channel: string;
        expireAt: Date;
        event?: string;
        message: string;
        bonus_code?: string;
        users: string[];
    }

    interface FAQ extends BaseDocument {
        author?: string;
        server?: string;
        question: string;
        answer: string;
        public?: boolean;
    }

}

export namespace Telegram {

    interface Keyboard extends BaseDocument {
        id: number;
        command: string;
        input: string[];
        expireAt: Date;
    }

    interface User extends BaseDocument {
        id: number;
        admin_level: AdminLevel;
        commands: Array<{
            command: string,
            uses: number
        }>;
    }

}

type GameTag = "airport" | "am4" | "plane" | "aviation" | "logo";
type UserIdentifier = string | number;

export namespace Quiz {

    interface User extends BaseDocument {
        id: UserIdentifier;
        points: number;
        score?: number;
    }

    interface Game extends BaseDocument {
        base_question?: string;
        author: string;
        name: string;
        tag: GameTag;
        played: number;
        reward: number;
    }

    interface Question extends BaseDocument {
        type: "text" | "image";
        tags: GameTag[];
        difficulty: "hard" | "easy";
        question: string | Binary;
        answers: string[];
    }

}

export namespace Settings {

    interface User extends BaseDocument {
        id: UserIdentifier;
        mode?: GameMode;
        training: {
            fuel: number;
            co2: number;
            cargo_heavy: number;
            cargo_large: number;
        };
        salaries: {
            pilot: number;
            crew: number;
            engineer: number;
            tech: number;
        };
        preference: {
            pax: [PaxSeat, PaxSeat, PaxSeat];
            cargo: [CargoLoad, CargoLoad];
        };
        options: {
            show_warnings: boolean;
            show_tips: boolean;
            cost_index: number;
            fuel_price: number;
            co2_price: number;
            activity: number;
            code: "icao" | "iata";
        };
    }

    interface Webhook extends BaseDocument {
        id: string;
        token: string;
        server: string;
        role: string;
        channel: string;
        fuel: {
            enabled: boolean;
            max: number;
        };
        co2: {
            enabled: boolean;
            max: number;
        };
    }

    interface Server extends BaseDocument {
        id: string;
        alliance_name?: string;
        log_channel?: string;
        update_nickname: boolean;
        update_roles: boolean;
        channels: {
            whitelist: string[];
            blacklist: string[];
        };
        roles: {
            default?: string;
            realism?: string;
            member?: string;
            easy?: string;
        };
    }

    interface Plane extends BaseDocument {
        id: UserIdentifier;
        planeID: ObjectId;
        engine?: string;
        modifications: {
            fuel: boolean;
            co2: boolean;
            speed: boolean;
        };
    }
    
}