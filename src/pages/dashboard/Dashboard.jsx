import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { AppContext } from '../../contexts/AppContext.jsx'; // RUTA CORREGIDA

// Componente de Dashboard (Vista General)
const Dashboard = () => {
  const { db } = useContext(AppContext);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db) return;

    const fetchSummary = async () => {
      try {
        // Productos
        const productsQuery = collection(db, 'productos');
        const productsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
          const productsData = snapshot.docs.map(doc => doc.data());
          const lowStock = productsData.filter(p => p.cantidadInventario < 10).length; // Umbral de 10 para stock bajo
          setSummary(prev => ({
            ...prev,
            totalProducts: productsData.length,
            lowStockProducts: lowStock,
          }));
        }, (err) => {
          console.error("Error fetching products for dashboard:", err);
          setError("Error al cargar datos de productos.");
        });

        // Órdenes
        // CAMBIO CLAVE: Cambiado 'ordenes' a 'orders' para que coincida con las reglas de seguridad
        const ordersQuery = collection(db, 'orders');
        const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
          const ordersData = snapshot.docs.map(doc => doc.data());
          const pending = ordersData.filter(o => o.estado === 'pendiente' || o.estado === 'procesando').length;
          setSummary(prev => ({
            ...prev,
            totalOrders: ordersData.length,
            pendingOrders: pending,
          }));
        }, (err) => {
          console.error("Error fetching orders for dashboard:", err);
          setError("Error al cargar datos de órdenes.");
        });

        setLoading(false);

        return () => {
          productsUnsubscribe();
          ordersUnsubscribe();
        };
      } catch (err) {
        console.error("Error general al obtener el resumen del dashboard:", err);
        setError("Error al cargar el resumen del dashboard.");
        setLoading(false);
      }
    };

    fetchSummary();
  }, [db]);

  if (loading) return <div className="text-center p-8">Cargando resumen...</div>;
  if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Resumen del Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-blue-600 mb-2">{summary.totalProducts}</div>
          <p className="text-lg text-gray-700">Productos Totales</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-green-600 mb-2">{summary.totalOrders}</div>
          <p className="text-lg text-gray-700">Órdenes Totales</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-yellow-600 mb-2">{summary.pendingOrders}</div>
          <p className="text-lg text-gray-700">Órdenes Pendientes</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
          <div className="text-5xl font-bold text-red-600 mb-2">{summary.lowStockProducts}</div>
          <p className="text-lg text-gray-700">Productos con Poco Stock</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
