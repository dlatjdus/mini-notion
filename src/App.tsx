import { createBrowserRouter, RouterProvider, type RouteObject, Navigate } from 'react-router-dom';
import  RootLayout  from './layout/RootLayout';
import  NotFoundPage  from './pages/NotFoundPage';
import HomePage from './pages/HomePage';
import EditPage from './pages/EditPage';
import  LoginPage  from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import PublicLayout from './layout/PublicLayout';
import ProtectedLayout from './layout/ProtectedLayout';

// 인증 없이 접근 가능한 라우트
const publicRoutes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout/>,
    errorElement: <NotFoundPage/>,
    children: [
      { index: true, element: <Navigate to='/login' replace/> },
      { path: 'login', element: <LoginPage/> },
      { path: 'signup', element: <SignupPage/> },
    ]
  }
]

// 인증이 필요한 라우트
const protectedRoutes: RouteObject[] = [
  {
    path: '/',
    element: <ProtectedLayout/>,
    errorElement: <NotFoundPage/>,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: 'my', element: <HomePage /> },
          { path: 'page/:pageId', element: <EditPage /> },
        ],
      },
    ],
  }
]

const router = createBrowserRouter([
  ...publicRoutes,
  ...protectedRoutes,
])


function App() {
  return (
    <>
    <RouterProvider router={router}/>
    </>
  )
}

export default App
