import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api';
import { type PageDetail, type PageImage, type SidebarProps } from '../types/page';
import { API_BASE } from '../api';

export default function EditPage() {
    const { pageId } = useParams();
    const navigate = useNavigate();

    const id = Number(pageId);
    const [loading, setLoading] = useState(true);
    
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const [images, setImages] = useState<PageImage[]>([]);
    const [uploading, setUploading] = useState(false);

    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    // "/uploads/.."를 "http://localhost:4000/uploads/.."로 바꾸는 함수
    const imageSrc = useMemo(() => {
        return (u: string) => (u.startsWith("http") ? u : `${API_BASE}${u}`);
    }, []);

    // 페이지 상세 불러오기
    useEffect(() => {
        if (!Number.isFinite(id)) return;

        (async () => {
            try {
                setLoading(true);
                const res = await apiFetch(`/pages/${id}`);
            
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert('페이지 불러오기 실패: ' + (err.message ?? 'unknown'));
                    setLoading(false);
                    return;
                }

                const data = (await res.json()) as {page: PageDetail};
                setTitle(data.page.title ?? '');
                setContent(data.page.content ?? '');
                setUpdatedAt(data.page.updatedAt ?? null);
            } catch(e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    // 페이지 저장
    const handleSave = async () => {
        const res = await apiFetch(`/pages/${id}`, {
            method: 'PUT', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title, content}),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert('저장 실패: ' + (err.message ?? 'unknown'));
            return;
        }
        console.log("내용 저장됨:", res);
    }

    // 페이지 삭제 --> 목록 새로고침 되게 해야지!
    const handleDeletePage = async () => {
        const ok = confirm('이 페이지 삭제?');
        if (!ok) return;

        const res = await apiFetch(`/pages/${id}`, { method: 'DELETE'});
        if (!res.ok) {
            const err = await res.json().catch(() =>({}));
            alert('삭제 실패: ' + (err.message ?? 'unknown'));
            return;
        }

        navigate('/my');
    }    

    // 이미지 목록 불러오기
    const loadImages = async() => {
        const res = await apiFetch(`/pages/${id}/images`);
        if (!res.ok) return;
        const data = await res.json();
        setImages(data.images ?? []);
    };

    useEffect(() => {
        if (!Number.isFinite(id)) return;
        loadImages();
    }, [id]);

    // 이미지 업로드 함수
    const handleUpload = async(file: File) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("image", file);   // ⭐ backend upload.single("image")랑 이름 일치
            
            const res = await apiFetch(`/pages/${id}/images`, {
                method: "POST", 
                body: fd,
                // headers 넣지 않기
            });

            setUpdatedAt(new Date().toISOString());

            if (!res.ok) {
                const err = await res.text().catch(() => ({}));
                alert(`업로드 실패 (${res.status}): ${err || res.statusText}`);
                return;
            }

            await loadImages();
        } finally {
            setUploading(false);
        }
    }

    // 이미지 삭제 함수
    const handleDeleteImage = async (imageId: number) => {
        const ok = confirm("이미지 삭제?");
        if (!ok) return;
        const res = await apiFetch(`/pages/${id}/images/${imageId}`, {
            method: "DELETE",
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            alert(`이미지 삭제 실패 (${res.status}): ${text || res.statusText}`);
            return;
        }

        setImages((prev) => prev.filter((img) => img.id !== imageId));
    }

    // 날짜 format 함수
    const formatDate = (iso?: string | null) => {
        if (!iso) return;
        const d= new Date(iso);
        return d.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // return이 포함된 조건문은 리액트 훅 아래에 있어야 함
    if (!Number.isFinite(id)) return <div>잘못된 pageId</div>;
    if (loading) return <div>불러오는 중...</div>;

    return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-col gap-1">
        {updatedAt && (
            <div className="text-xs text-gray-400">
                마지막 편집: {formatDate(updatedAt)}
            </div>
        )}  
        <div className="flex items-center gap-2">
            <input
            className="border px-3 py-2 rounded w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            />
            <button className="border px-3 py-2 rounded" onClick={handleSave}>
            저장
            </button>
            <button className="border px-3 py-2 rounded" onClick={handleDeletePage}>
            삭제
            </button>
        </div>
      </div>

      <textarea
        className="border px-3 py-2 rounded min-h-[300px]"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용"
      />

      {/* 이미지 업로드 */}
      <div className="flex items-center gap-3">
        <label className="border px-3 py-2 rounded cursor-pointer">
          {uploading ? '업로드 중...' : '이미지 추가'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <span className="text-sm text-gray-500">최대 5MB</span>
      </div>

      {/* 이미지 목록 */}
      {images.length === 0 ? (
        <div className="text-sm text-gray-500">첨부된 이미지가 없어요.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative border rounded overflow-hidden group">
              <img
                src={imageSrc(img.url)}
                alt={img.originalName ?? `image-${img.id}`}
                className="w-full h-40 object-cover"
              />

              {/* 삭제 버튼*/}
              <button
                type="button"
                onClick={() => handleDeleteImage(img.id)}
                className="absolute top-0 right-0 hidden group-hover:flex items-center justify-center
                w-8 h-8  bg-white/60 text-white text-lg hover:bg-white/80"
                aria-label="이미지 삭제"
                title="삭제"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}