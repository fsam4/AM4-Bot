/**
 * A base class for client errors
 * @constructor
 * @param message - The error message
 */

export default abstract class ClientError {

    protected constructor(protected readonly message: string) {}

    /**
     * Display the error message as a string
     * @returns The error message
     */

    public toString() {
        return this.message;
    }

}