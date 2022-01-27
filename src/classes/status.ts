type RequestStatus = "failed" | "success";

interface AM4Status {
    request: RequestStatus;
    requests_remaining: number;
    description?: string;
}

/**
 * Represents the API status
 * @constructor
 * @param status - The raw status or request data
 */

export default abstract class Status {
    protected _status: AM4Status;
    public readonly status: {
        readonly requestsRemaining: number;
        success: boolean;
        error?: string;
    }
    constructor(status: AM4Status) {
        this._status = status;
        this.status = {
            requestsRemaining: status.requests_remaining ?? null,
            success: status.request === "success"
        };
        if ("description" in status) this.status.error = status.description;
    }
}