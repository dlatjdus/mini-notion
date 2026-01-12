export interface PageListItem {
    id: number;
    title: string;
    updatedAt?: string;     // 정렬
}

export interface PageDetail {
    id: number;
    title: string;
    content: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface PageImage {
    id: number;
    pageId: number;
    url: string;
    originalName?: string | null;
    createdAt?: string;
}

export interface SidebarProps {
    pages: PageListItem[];
    onAddPage: (title: string) => void;
}

export interface PageContextType {
    handleDeletePage: (pageId: number) => Promise<void>;
}