import type { WebFetch } from "../../../shared/types";
export interface WebFetchListProps {
    fetches: WebFetch[];
}
/** The pages the model fetched for a reply: in progress, read (linked), or failed. */
export declare function WebFetchList({ fetches }: WebFetchListProps): import("react").JSX.Element;
