type RequestStatus = "failed" | "success";

interface AM4Status {
    request: RequestStatus;
    requests_remaining: number;
    description?: string;
}
interface ToolsStatus {
    status: number;
    quotas?: number;
    error?: string;
}

/**
 * Represents the API status
 * @constructor
 * @param status - The raw status or request data
 */

export default abstract class Status {
    protected _status: AM4Status | ToolsStatus;
    public readonly status: {
        readonly requestsRemaining: number;
        success: boolean;
        error?: string;
    }
    constructor(status: AM4Status | ToolsStatus) {
        this._status = status;
        if ("request" in status) {
            this.status = {
                requestsRemaining: status.requests_remaining ?? null,
                success: status.request === "success"
            };
            if ("description" in status) this.status.error = status.description;
        } else {
            this.status = {
                requestsRemaining: status.quotas ?? null,
                success: 200 <= status.status && status.status <= 299
            }
            if ("error" in status) this.status.error = status.error;
        }
    }
}