import type { Request } from '@typings/am4-api'

type APIStatus = Request["status"];

/**
 * A class representing an AM4 API Error
 * @constructor
 * @param status - The raw status
 */

export default class AM4APIError extends Error implements Omit<APIStatus, "description"> {
    public request: 'failed' | 'success';
    public requests_remaining: number;
    constructor(status: APIStatus) {
        super(status.description);
        this.name = "AM4 API Error";
        this.requests_remaining = status.requests_remaining;
        this.request = status.request;
    }
}