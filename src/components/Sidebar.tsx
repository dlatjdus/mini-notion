import { useNavigate, useParams } from 'react-router-dom';
import { type SidebarProps }  from '../types/page';
import { useState } from 'react'; 
import { LogoutButton } from './LogoutButton.tsx';

export const Sidebar = ({pages, onAddPage}: SidebarProps) => {
    const navigate = useNavigate();
    const { pageId } = useParams();
    
    const [addIsOpen, setAddIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    
    const submit = () => {
        const trimmed = title.trim();
        if (!trimmed) return;

        onAddPage(trimmed);
        setTitle('');
        setAddIsOpen(false);
    }

    return (
            <aside className='w-80 h-full border-r border-gray-200 bg-gradient-to-b from-gray-50 to-white'>
                <div className='h-full px-4 py-5 '>
                    <LogoutButton/>
                    <div className='py-6'>
                        <h2>Notion 따라하기</h2>
                    </div>
                    <button 
                    className='px-4 py-2 bg-white rounded'
                    onClick={() => setAddIsOpen(true)}>
                        + 새 페이지
                    </button>
                    {addIsOpen && <div>
                        <input
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') submit();
                            if (e.key === 'Escape') {
                                setAddIsOpen(false);
                                setTitle('');
                            }
                        }}
                        placeholder='새 페이지 이름'
                        />
                        </div>
                    }

                    <nav className='py-6 space-y-1'>
                        {pages.map((p) => {
                            const active = p.id === Number(pageId);

                            return (
                                <div 
                                key={p.id}
                                className={`group flex w-full text-left rounded-md px-3 py-2 text-sm
                                transition-colors duration-150
                                ${active ? "bg-white" : "text-gray-700 hover:bg-white/60"}`}
                                >
                                    <button
                                    onClick={() => navigate(`/page/${p.id}`)}
                                    className='flex-1 text-left'
                                    >
                                        {p.title}
                                    </button>

                                    <button>
                                        🗑️
                                    </button>
                                </div>
                            )
                        })}
                    </nav>
                </div>
            </aside>
    )
}