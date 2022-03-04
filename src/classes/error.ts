import type { Status } from '@typings/am4-api'

type AM4RequestStatus = Status["status"];
type StatusBody = Omit<AM4RequestStatus, "description">;

/**
 * A class representing an AM4 API Error
 * @constructor
 * @param status - The raw status
 */

export default class AM4APIError extends Error implements StatusBody {
    public request: 'failed' | 'success';
    public requests_remaining: number;
    constructor(status: AM4RequestStatus) {
        super(status.description);
        this.name = "AM4 API Error";
        this.requests_remaining = status.requests_remaining;
        this.request = status.request;
    }
}