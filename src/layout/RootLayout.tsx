import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { type PageListItem } from '../types/page';

export default function RootLayout() {
    const { pageId } = useParams();

    const id = Number(pageId);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const [pages, setPages] = useState<PageListItem[]>([]);
    const [loading, setLoading] = useState(false);

    // 1. 페이지 목록 불러오기
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const res = await apiFetch('/pages');
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    console.log('GET /pages failed', err);
                    return;
                }
                const data = await res.json();
                setPages(data.pages ?? []);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // 2. 새 페이지 생성(서버로 POST)
    const handleAddPage = async (title: string) => {
        const res = await apiFetch('/pages', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title, content: ''}),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert('페이지 생성 실패: ' + (err.message ?? 'unknown'));
            return;
        }

        const data = await res.json();
        const newId = data.id as number;

        setPages(prev => [{ id: newId, title}, ...prev]);
        navigate(`/page/${newId}`);
    }

    // 페이지 추가가 제대로 되는지 확인하기 위한 로그
    useEffect(() => {
        console.log("페이지 변화: ", pages);
    }, [pages])

    return (
        <div className='h-screen overflow-hidden'>
            <div className='flex h-full'>
                {isSidebarOpen && 
                <Sidebar 
                    pages={pages} 
                    onAddPage={handleAddPage}
                />
                }
                <main className='flex-1 min-w-0 overflow-y-auto p-10'>
                    <button 
                    className='py-2'
                    onClick={() => setIsSidebarOpen(v => !v)}
                    >
                        ☰
                    </button>
                    <Outlet/>
                </main>
            </div>
        </div>
    )
}