import type { LoginInput } from "../model";
export interface LoginResponse {
    id: string;
    email: string;
}
export declare function loginUser(input: LoginInput): Promise<LoginResponse>;
export declare function logoutUser(): Promise<void>;
