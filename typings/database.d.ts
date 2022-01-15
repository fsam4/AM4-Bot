import type { Binary, ObjectId } from "bson";

type PaxSeat = 'Y' | 'J' | 'F';
type CargoLoad = 'H' | 'L';

interface BaseDocument {
    _id?: ObjectId;
}

type LogData = { value: number, date: Date };

export namespace AM4_Data {
    
    interface achievement extends BaseDocument {
        name: string;
        description?: string;
        bonus_points: number;
        route: ObjectId[];
        icon: Binary;
        hint: string;
        image?: string;
    }

    interface airport extends BaseDocument {
        city: string;
        country: string;
        country_code: string;
        market: number;
        runway: number;
        icao: string;
        iata: string;
        location: {
            type: "Point";
            coordinates: [number, number];
        };
    }

    interface alliance extends BaseDocument {
        name: string;
        archived?: true;
        values: LogData[];
    }

    interface member extends BaseDocument {
        name: string;
        allianceID: ObjectId;
        joined: Date;
        flights: number;
        contribution: number;
        sv: LogData[];
        offline: LogData[];
        dailyContribution: LogData[];
        expireAt: Date;
    }

    interface plane extends BaseDocument {
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
        }
        A_check: {
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
            fuel: number;
            speed: number;
        }>
    }

    interface route extends BaseDocument {
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

    interface user extends BaseDocument {
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

    interface notification extends BaseDocument {
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

    interface panel extends BaseDocument {
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

    interface giveaway extends BaseDocument {
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

    interface faq extends BaseDocument {
        author?: string;
        server?: string;
        question: string;
        answer: string;
        public?: boolean;
    }

}

export namespace Telegram {

    interface keyboard extends BaseDocument {
        id: number;
        command: string;
        input: string[];
        expireAt: Date;
    }

    interface user extends BaseDocument {
        id: number;
        airline_id: number;
        admin_level: AdminLevel;
        commands: Array<{
            command: string,
            uses: number
        }>;
    }

}

type GameTag = "airport" | "am4" | "plane" | "aviation" | "logo";
type QuestionDifficulty = "hard" | "easy";
type QuestionType = "text" | "image";

export namespace Quiz {

    interface user extends BaseDocument {
        id: string | number,
        points: number,
        score?: number
    }

    interface game extends BaseDocument {
        base_question?: string;
        author: string,
        name: string,
        tag: GameTag;
        played: number,
        reward: number
    }

    interface question<T extends QuestionType = QuestionType> extends BaseDocument {
        type: T;
        tags: GameTag[];
        question: T extends 'text' ? string : Binary;
        difficulty: QuestionDifficulty;
        answers: string[];
    }

}

export namespace Settings {

    interface user extends BaseDocument {
        id: string;
        mode?: 'easy' | 'realism';
        training: {
            fuel: number,
            co2: number,
            cargo_heavy: number,
            cargo_large: number
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

    interface webhook extends BaseDocument {
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

    interface server extends BaseDocument {
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
            easy?: string;
            member?: string;
        };
    }

    interface plane extends BaseDocument {
        id: string;
        planeID: ObjectId;
        engine?: string;
        modifications: {
            fuel: boolean,
            co2: boolean,
            speed: boolean
        }
    }
    
}