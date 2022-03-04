import type { Status as APIStatus } from '@typings/am4-api';

type AM4RequestStatus = APIStatus["status"];

/**
 * Represents the AM4 API request status
 * @constructor
 * @param status - The raw status or request data
 * @param accessToken - The access token that was used to make this request
 */

export default abstract class Status {
    protected _status: AM4RequestStatus;
    public readonly status: {
        readonly requestsRemaining: number;
        readonly accessToken: string;
        success: boolean;
        error?: string;
    }
    protected constructor(status: AM4RequestStatus, accessToken: string) {
        Object.defineProperty(this, "_status", {
            value: status,
            writable: true,
            configurable: true
        });
        // @ts-expect-error: defining access token with Object.defineProperty later
        this.status = {
            requestsRemaining: status.requests_remaining ?? null,
            success: status.request === "success"
        };
        Object.defineProperty(this.status, "accessToken", { value: accessToken });
        if ("description" in status) this.status.error = status.description;
    }
}