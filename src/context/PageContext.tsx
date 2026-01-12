import { createContext, useContext } from "react";
import { type PageContextType } from "../types/page";

export const PageContext = createContext<PageContextType | null>(null);

export function usePageContext() {
    return(
        <>pagecontext 만들거야...</>
    )
}