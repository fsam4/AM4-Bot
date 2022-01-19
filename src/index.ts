import fetch from 'node-fetch';

import Airline from './classes/airline';
import Alliance from './classes/alliance';
import Route from './classes/route';
import Routes from './classes/routes';
import Stopover from './classes/stopover';
import Airport from './classes/airport';
import Aircraft from './classes/aircraft';
import AM4APIError from './classes/error';

import type * as AM4 from '@typings/api/am4';
import type * as Tools from '@typings/api/tools';

const toolsBaseUrl = "https://api.am4tools.com";
const AM4BaseUrl = "https://www.airline4.net/api";

type FieldType = "demand" | "research";
type RouteOptions<T extends FieldType> = T extends "demand"
    ? { dep_icao: string, arr_icao: string } 
    : { dep_icao: string, min_runway: number, max_distance: number };

interface Client {
    readonly accessToken: string;
    requestsRemaining: number;
    lastRequest?: Date;
}

type ClientOptions = Partial<{
    accessToken: Partial<{
        am4: string;
        tools: string;
    }>;
}>;

/**
 * AM4 rest client for communicating with AM4 API and AM4 Tools API.
 * Does not contain methods for all endpoints. Only the ones that are used in the code.
 * @constructor
 * @param options - The options for this client
 */

export default class AM4RestClient {
    public am4?: Client;
    public tools?: Client;
    constructor(options?: ClientOptions) {
        if (options?.accessToken?.am4) {
            this.am4 = {
                accessToken: options.accessToken.am4,
                requestsRemaining: 800
            }
        }
        if (options?.accessToken?.tools) {
            this.tools = {
                accessToken: options.accessToken.tools,
                requestsRemaining: 350
            }
        }
    }

    private set requestsRemaining(value: number) {
        this.am4.requestsRemaining = value;
        this.am4.lastRequest = new Date();
    }

    /**
     * Set a new access token for the AM4 Tools or AM4 API client
     * @param accessToken The new access token
     * @param type The client type
     * @returns The updated client
     */

    public setAccessToken(accessToken: string, type: "am4" | "tools") {
        this[type] = {
            accessToken: accessToken,
            requestsRemaining: type === "am4" ? 800 : 350
        }
        return this;
    }

    /**
     * Fetches an airline from the AM4 API
     * @param input - The airline name or ID
     * @returns The constructed airline data
     */

    public async fetchAirline(input: string | number): Promise<Airline> {
        if (!this.am4?.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({ access_token: this.am4.accessToken });
        query.append(typeof input === 'string' ? "user" : "id", input.toString());
        const response: AM4.Airline = await fetch(`${AM4BaseUrl}?${query}`).then(response => response.json());
        if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
        this.requestsRemaining = response.status.requests_remaining; 
        return new Airline(response, this, typeof input === "number" ? input : null);
    }

    /**
     * Fetches an alliance from the AM4 API
     * @param input - The name of the alliance
     * @returns The constructed alliance data
     */

    public async fetchAlliance(input: string): Promise<Alliance> {
        if (!this.am4?.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({
            access_token: this.am4.accessToken,
            search: input
        });
        const response: AM4.Alliance = await fetch(`${AM4BaseUrl}?${query}`).then(response => response.json());
        if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
        this.requestsRemaining = response.status.requests_remaining; 
        return new Alliance(response, this);
    }

    /**
     * Fetches routes from the AM4 API
     * @param mode - Demand to search for a demand of a route, research for searching multiple routes from a hub.
     * @param options - Additional required options for the search
     * @returns The constructed route data
     */

    public async fetchRoute<T extends FieldType>(mode: T, parameters: RouteOptions<T>): Promise<T extends 'demand' ? Route : Routes> {
        if (!this.am4?.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({
            access_token: this.am4.accessToken,
            fields: mode
        });
        for (const key in parameters) {
            const value = parameters[key].toString();
            query.append(key, value);
        }
        type route = T extends 'demand' ? AM4.Route : AM4.Routes;
        const response: route = await fetch(`${AM4BaseUrl}?${query}`).then(response => response.json());
        if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
        this.requestsRemaining = response.status.requests_remaining; 
        // @ts-ignore: the return type will always be correct at runtime
        return (mode === "demand" ? new Route(response, this, parameters) : new Routes(response));
    }

    /**
     * Fetches a stopover from AM4 Tools API
     * @param options - The details about the route
     * @returns The constructed stopover for the route
     */

    public async fetchStopover(parameters: { type: 'pax' | 'cargo', departure: string, arrival: string, model: string }): Promise<Stopover> {
        if (!this.tools?.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({ mode: 'normal' });
        for (const key in parameters) {
            const value = parameters[key].toString();
            query.append(key, value);
        }
        const response = await fetch(`${toolsBaseUrl}/route/stopover?${query}`, {
            headers: {
                "x-access-token": this.tools.accessToken
            }
        });
        const body: Tools.Stopover = await response.json();
        this.tools.requestsRemaining = body.request.quotas;
        return new Stopover(body);
    }

    /**
     * Fetches airports from AM4 Tools API
     * @param parameters - Filter options for the airports
     * @returns The constructed airport data
     */

    public async fetchAirports(parameters: { region?: string, market?: number, runway?: number } | { code: string } | { id: number }): Promise<Airport> {
        if (!this.tools?.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({ mode: 'normal' });
        for (const key in parameters) {
            const value = parameters[key].toString();
            query.append(key, value);
        }
        const response = await fetch(`${toolsBaseUrl}/airport/search?${query}`, {
            headers: {
                "x-access-token": this.tools.accessToken
            }
        });
        const body: Tools.Airports = await response.json();
        this.tools.requestsRemaining = body.request.quotas;
        return new Airport(body);
    }

    /**
     * Fetches aircrafts from AM4 Tools API
     * @param parameters - Filter options for the aircrafts
     * @returns The constructed aircraft data
     */

    public async fetchAircrafts(parameters: ({ price?: number, speed?: number, capacity?: number, range?: number, co2?: number, fuel?: number } | { model: string } | { id: number }) & { type: 'pax' | 'cargo' }): Promise<Aircraft> {
        if (!this.tools?.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({ mode: 'normal' });
        for (const key in parameters) {
            const value = parameters[key].toString();
            query.append(key, value);
        }
        const response = await fetch(`${toolsBaseUrl}/aircraft/search?${query}`, {
            headers: {
                "x-access-token": this.tools.accessToken
            }
        });
        const body: Tools.Planes = await response.json();
        this.tools.requestsRemaining = body.request.quotas;
        return new Aircraft(body);
    }

}