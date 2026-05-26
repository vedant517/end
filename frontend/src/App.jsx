import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import ProductMedia from './pages/admin/productMedia';
import AdminProfile from './pages/admin/adminprofile';
import Coupons from'./pages/admin/Coupons';   

import Dashboard from './pages/admin/Dashboard';
import Login from './pages/admin/Login';
import AddProduct from './pages/admin/AddProduct';
import Products from './pages/admin/Products';
import Order from './pages/admin/Order';
import Transactions from './pages/admin/Transactions';
import Customers from './pages/admin/Customers';
import ProductReviews from './pages/admin/ProductReviews';
import Categories from './pages/admin/Categories';
import Enquiries from './pages/admin/Enquiries';
import ProductReviewPage from './pages/user/ProductReviewPage';
import AuthLogin from './pages/user/AuthLogin';
import Shop from './pages/user/Shop';

const LoadingSpinner = () => (
  <div className="flex-1 flex items-center justify-center min-h-[400px]">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-[#85754E] rounded-full animate-spin"></div>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('isLoggedIn'));

  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('isLoggedIn'));
    };
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route
            path="/"
            element={!isAuthenticated ? <Login setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/dashboard" replace />}
          />
          
          {/* Public / User routes */}
          <Route path="/login" element={<AuthLogin />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id/reviews" element={<ProductReviewPage />} />


          {/* Protected Dashboard Routes */}
          <Route
            element={isAuthenticated ? <AdminLayout setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" replace />}
          >
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/add-product" element={<AddProduct />} />
            <Route path="/edit-product/:id" element={<AddProduct />} />
            <Route path="/orders" element={<Order />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/media" element={<ProductMedia />} />
            <Route path="/reviews" element={<ProductReviews />} />
            <Route path="/roles" element={<AdminProfile />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/enquiries" element={<Enquiries />} />
            <Route path="*" element={<div className="p-8 text-slate-400 text-center"></div>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
