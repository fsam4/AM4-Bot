import { fetch } from 'undici';

import Airline from './classes/airline';
import Alliance from './classes/alliance';
import Route from './classes/route';
import Routes from './classes/routes';
import AM4APIError from './classes/error';

import type * as AM4 from '@typings/am4-api';

const AM4BaseUrl = "https://www.airline4.net/api";

type FieldType = "demand" | "research";
type RouteOptions<T extends FieldType> = { dep_icao: string } & (
    T extends "research" 
        ? { min_runway: number, max_distance: number }
        : { arr_icao: string }
);

/**
 * AM4 API rest client for communicating with the API.
 * @constructor
 * @param accessToken - The AM4 API access token to use
 */

export default class AM4RestClient {
    #requestsRemaining: number;
    public lastRequest?: Date;
    constructor(public accessToken?: string) {
        if (this.accessToken) {
            this.requestsRemaining = 800;
        }
    }

    set requestsRemaining(value: number) {
        this.#requestsRemaining = value;
        this.lastRequest = new Date();
    }

    get requestsRemaining() {
        return this.#requestsRemaining;
    }

    /**
     * Set a new access token for the rest client
     * @param accessToken - The new access token
     * @returns The updated client
     */

    public setAccessToken(accessToken: string) {
        this.accessToken = accessToken;
        this.requestsRemaining = 800;
        delete this.lastRequest;
        return this;
    }

    /**
     * Fetches an airline from the AM4 API
     * @param input - The airline name or ID
     * @returns The constructed airline data
     */

    public async fetchAirline(input: string | number): Promise<Airline> {
        if (!this.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({ access_token: this.accessToken });
        query.append(typeof input === 'string' ? "user" : "id", input.toString());
        const response = await fetch(`${AM4BaseUrl}?${query}`).then(res => res.json()) as AM4.Airline;
        if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
        this.requestsRemaining = response.status.requests_remaining; 
        return new Airline(response, this, typeof input === "number" && input);
    }

    /**
     * Fetches an alliance from the AM4 API
     * @param input - The name of the alliance
     * @returns The constructed alliance data
     */

    public async fetchAlliance(input: string): Promise<Alliance> {
        if (!this.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({
            access_token: this.accessToken,
            search: input
        });
        const response = await fetch(`${AM4BaseUrl}?${query}`).then(res => res.json()) as AM4.Alliance;
        if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
        this.requestsRemaining = response.status.requests_remaining; 
        return new Alliance(response, this);
    }

    /**
     * Fetches routes from the AM4 API
     * @param mode - Demand to search for a demand of a route, research for searching multiple routes from a hub.
     * @param parameters - Additional required options for the search
     * @returns The constructed route data
     */

    public async fetchRoute<T extends FieldType>(mode: T, parameters: RouteOptions<T>): Promise<T extends 'demand' ? Route : Routes> {
        if (!this.accessToken) throw new Error("Missing access token");
        const query = new URLSearchParams({
            access_token: this.accessToken,
            fields: mode
        });
        for (const key in parameters) {
            const value = parameters[key].toString();
            query.append(key, value);
        }
        type RouteResponse = T extends 'demand' ? AM4.Route : AM4.Routes;
        const response = await fetch(`${AM4BaseUrl}?${query}`).then(res => res.json()) as RouteResponse;
        if (response.status.description === 'Missing or invalid access token') throw new AM4APIError(response.status);
        this.requestsRemaining = response.status.requests_remaining; 
        const RouteConstructor = mode === "demand" ? Route : Routes;
        // @ts-ignore: the return type will always be correct at runtime
        return new RouteConstructor(response, this);
    }

}