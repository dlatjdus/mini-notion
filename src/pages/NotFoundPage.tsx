import {useRouteError} from 'react-router-dom'

export default function NotFoundPage() {
    const error = useRouteError();
    console.log('에러: ', error);

    return (
        <>
        NotFoundPage 입니다
        </>
    )
}