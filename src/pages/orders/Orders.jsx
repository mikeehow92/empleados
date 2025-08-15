import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { AppContext } from './AppContext.jsx'; // Ruta corregida
import { useModal } from './hooks/useModal.js'; // Ruta corregida
import CustomModal from './components/CustomModal.jsx'; // Ruta corregida
import { getFunctions, httpsCallable } from 'firebase/functions';

// Componente de Gestión de Órdenes
const Orders = () => {
  const { db } = useContext(AppContext);
  const { showAlert, showConfirm, closeModal, modalState } = useModal();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const orderStatuses = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];

  // Inicializar Cloud Functions
  const functions = getFunctions();
  const updateOrderStatus = httpsCallable(functions, 'updateOrderStatus');

  useEffect(() => {
    if (!db) {
      setError("La base de datos no está inicializada.");
      setLoading(false);
      return;
    }

    // Se eliminó la función orderBy para evitar errores de compilación
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        let estado = data.estado;

        if (typeof estado === 'object') {
          estado = estado.stringValue || 'desconocido';
        }

        return {
          id: doc.id,
          ...data,
          estado: estado,
        };
      });
      // Ordenar los datos en el cliente después de recibirlos
      ordersData.sort((a, b) => {
        const dateA = a.fechaOrden ? new Date(a.fechaOrden._seconds * 1000) : new Date(0);
        const dateB = b.fechaOrden ? new Date(b.fechaOrden._seconds * 1000) : new Date(0);
        return dateB - dateA;
      });
      setOrders(ordersData);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener las órdenes:", err);
      setError("No se pudieron cargar las órdenes. Por favor, inténtalo de nuevo.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    // Buscar la orden en el estado local para obtener el userId
    const orderToUpdate = orders.find(order => order.id === orderId);

    if (!orderToUpdate || !orderToUpdate.userId) {
      showAlert('No se pudo encontrar el ID de usuario para esta orden.', 'error');
      return;
    }

    try {
      // Llamar a la Cloud Function con los datos necesarios
      const response = await updateOrderStatus({
        orderId: orderId,
        userId: orderToUpdate.userId,
        newStatus: newStatus
      });

      if (response.data.success) {
        showAlert('Estado de la orden actualizado con éxito.', 'success');
      } else {
        showAlert('Error al actualizar el estado de la orden.', 'error');
      }
    } catch (error) {
      console.error("Error al llamar a la Cloud Function:", error);
      showAlert(`Error: ${error.message}`, 'error');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'procesando':
        return 'bg-blue-100 text-blue-800';
      case 'enviado':
        return 'bg-indigo-100 text-indigo-800';
      case 'entregado':
        return 'bg-green-100 text-green-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="text-center py-10">Cargando órdenes...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Gestión de Órdenes</h1>
      <p className="text-gray-600 mb-6">Visualiza y actualiza el estado de las órdenes.</p>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay órdenes para mostrar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID de la Orden
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Productos
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.fechaOrden ? new Date(order.fechaOrden._seconds * 1000).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.total ? order.total.toFixed(2) : '0.00'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.estado)}`}>
                        {order.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <ul className="list-disc list-inside">
                        {order.items && order.items.map((item, index) => (
                          <li key={index}>{item.name} (x{item.quantity})</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <select
                        value={order.estado}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
                      >
                        {orderStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CustomModal {...modalState} />
    </div>
  );
};

export default Orders;
