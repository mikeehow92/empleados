import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AppContext } from './AppContext.jsx';
import { useModal } from './hooks/useModal.js';
import CustomModal from './components/CustomModal.jsx';

// Componente de Gestión de Productos
const Products = () => {
  const { db, storage } = useContext(AppContext);
  const { showAlert, showConfirm, closeModal, modalState } = useModal();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    cantidadInventario: '',
    categoria: '',
    imagen: null,
    imagenUrl: '',
  });

  useEffect(() => {
    console.log("Products.jsx: useEffect se ejecutó.");
    if (!db) {
      console.log("Products.jsx: db no está disponible.");
      setError("La base de datos no está inicializada.");
      setLoading(false);
      return;
    }

    console.log("Products.jsx: Intentando obtener productos de Firestore...");
    const q = query(collection(db, 'productos'), orderBy('fechaCreacion', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsData);
      setLoading(false);
      console.log("Products.jsx: Productos obtenidos con éxito.");
    }, (err) => {
      console.error("Products.jsx: Error al obtener productos:", err);
      setError("Error al cargar productos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setNewProduct(prev => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!db || !storage) {
      showAlert('La base de datos o el almacenamiento no están disponibles.');
      return;
    }
    try {
      let imageUrl = '';
      if (newProduct.imagen) {
        const imageRef = ref(storage, `product-images/${newProduct.imagen.name}`);
        await uploadBytes(imageRef, newProduct.imagen);
        imageUrl = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, 'productos'), {
        ...newProduct,
        precio: parseFloat(newProduct.precio),
        cantidadInventario: parseInt(newProduct.cantidadInventario, 10),
        imagen: imageUrl,
        fechaCreacion: new Date(),
      });
      showAlert('Producto añadido exitosamente!');
      resetForm();
    } catch (err) {
      console.error("Error al añadir producto:", err);
      showAlert(`Error al añadir producto: ${err.message}`);
    }
  };

  const handleEditProduct = (product) => {
    setIsEditing(true);
    setCurrentProduct(product);
    setNewProduct({ ...product });
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!db || !currentProduct) return;
    try {
      let imageUrl = newProduct.imagenUrl;
      if (newProduct.imagen && newProduct.imagen !== currentProduct.imagen) {
        const imageRef = ref(storage, `product-images/${newProduct.imagen.name}`);
        await uploadBytes(imageRef, newProduct.imagen);
        imageUrl = await getDownloadURL(imageRef);
      }

      const productDocRef = doc(db, 'productos', currentProduct.id);
      await updateDoc(productDocRef, {
        nombre: newProduct.nombre,
        descripcion: newProduct.descripcion,
        precio: parseFloat(newProduct.precio),
        cantidadInventario: parseInt(newProduct.cantidadInventario, 10),
        categoria: newProduct.categoria,
        imagenUrl: imageUrl,
      });
      showAlert('Producto actualizado exitosamente!');
      resetForm();
    } catch (err) {
      console.error("Error al actualizar producto:", err);
      showAlert(`Error al actualizar producto: ${err.message}`);
    }
  };

  const handleDeleteProduct = (productId) => {
    showConfirm('¿Estás seguro de que quieres eliminar este producto?', async () => {
      if (!db) {
        showAlert('La base de datos no está disponible.');
        closeModal();
        return;
      }
      try {
        await deleteDoc(doc(db, 'productos', productId));
        showAlert('Producto eliminado con éxito.');
        closeModal();
      } catch (err) {
        console.error("Error al eliminar producto:", err);
        showAlert(`Error al eliminar producto: ${err.message}`);
        closeModal();
      }
    });
  };

  const resetForm = () => {
    setIsAdding(false);
    setIsEditing(false);
    setCurrentProduct(null);
    setNewProduct({
      nombre: '',
      descripcion: '',
      precio: '',
      cantidadInventario: '',
      categoria: '',
      imagen: null,
      imagenUrl: '',
    });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Cargando productos...</div>;
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Gestión de Productos</h1>

      {/* Formulario de agregar/editar */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {isEditing ? 'Editar Producto' : 'Añadir Nuevo Producto'}
        </h2>
        <form onSubmit={isEditing ? handleUpdateProduct : handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="nombre"
              placeholder="Nombre del producto"
              value={newProduct.nombre}
              onChange={handleChange}
              required
              className="p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <input
              type="number"
              name="precio"
              placeholder="Precio"
              value={newProduct.precio}
              onChange={handleChange}
              required
              className="p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              name="cantidadInventario"
              placeholder="Cantidad en Inventario"
              value={newProduct.cantidadInventario}
              onChange={handleChange}
              required
              className="p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <input
              type="text"
              name="categoria"
              placeholder="Categoría"
              value={newProduct.categoria}
              onChange={handleChange}
              className="p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <textarea
            name="descripcion"
            placeholder="Descripción del producto"
            value={newProduct.descripcion}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all"
            rows="3"
          ></textarea>
          <input
            type="file"
            name="imagen"
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm transition-all"
          />
          <div className="flex justify-end space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
            >
              {isEditing ? 'Actualizar Producto' : 'Añadir Producto'}
            </button>
            {(isAdding || isEditing) && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-400 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-500 transition-colors shadow-md"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista de productos */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {products.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No hay productos para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imagen
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inventario
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => {
                  const displayPrice = typeof product.precio === 'number' ? product.precio : parseFloat(product.precio);
                  return (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.imagenUrl && (
                          <div className="w-20 h-20 bg-gray-200 rounded-md overflow-hidden">
                            <img
                              src={product.imagenUrl}
                              alt={product.nombre}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.cantidadInventario}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.categoria || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-600 hover:text-blue-900 mr-4 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CustomModal {...modalState} />
    </div>
  );
};

export default Products;
