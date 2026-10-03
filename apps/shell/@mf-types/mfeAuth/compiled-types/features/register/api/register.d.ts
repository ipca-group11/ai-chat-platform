import type { RegisterInput } from "../model";
export interface RegisterResponse {
    id: string;
    email: string;
}
export declare function registerUser(input: RegisterInput): Promise<RegisterResponse>;
