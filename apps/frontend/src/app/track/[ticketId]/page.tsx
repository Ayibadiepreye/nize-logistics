'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Map from '@/components/Map';
import api from '@/lib/api';
import { initSocket } from '@/lib/socket';
import { Package, MapPin, Clock, User, Phone, CheckCircle } from 'lucide-react';

export default function TrackOrder() {
  const { ticketId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [rider, setRider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrder();
    
    // Subscribe to real-time updates
    const socket = initSocket('');
    socket.emit('order:subscribe', ticketId);

    socket.on('order:status-update', (data) => {
      if (data.orderId === order?.id) {
        loadOrder();
      }
    });

    socket.on('rider:location-update', (data) => {
      if (data.riderId === rider?.id) {
        setRider((prev: any) => ({
          ...prev,
          currentLat: data.lat,
          currentLng: data.lng,
        }));
      }
    });

    return () => {
      socket.emit('order:unsubscribe', ticketId);
    };
  }, [ticketId]);

  const loadOrder = async () => {
    try {
      const { data } = await api.get(`/tracking/${ticketId}`);
      setOrder(data.order);
      setRider(data.rider);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Order not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card max-w-md text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <a href="/track" className="btn btn-primary">
              Try Again
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const statusSteps = [
    { key: 'pending', label: 'Order Placed', icon: Package },
    { key: 'assigned', label: 'Rider Assigned', icon: User },
    { key: 'picked_up', label: 'Package Picked Up', icon: CheckCircle },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status);

  const markers = [
    {
      position: [parseFloat(order.pickupLat), parseFloat(order.pickupLng)] as [number, number],
      popup: `<b>Pickup:</b> ${order.pickupAddress}`,
      icon: 'pickup' as const,
    },
    {
      position: [parseFloat(order.dropoffLat), parseFloat(order.dropoffLng)] as [number, number],
      popup: `<b>Dropoff:</b> ${order.dropoffAddress}`,
      icon: 'dropoff' as const,
    },
  ];

  if (rider?.currentLat && rider?.currentLng) {
    markers.push({
      position: [parseFloat(rider.currentLat), parseFloat(rider.currentLng)],
      popup: `<b>Rider:</b> ${rider.fullName}`,
      icon: 'pickup' as const, // Use pickup icon for rider
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="card mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{order.ticketId}</h1>
                <p className="text-gray-600">Track your package in real-time</p>
              </div>
              <div className={`badge badge-${order.status} text-lg`}>
                {order.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="card mb-6">
            <div className="flex justify-between items-center">
              {statusSteps.map((step, index) => {
                const Icon = step.icon;
                const isComplete = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isComplete ? 'bg-teal text-white' : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-teal-200' : ''}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <p className={`text-sm font-semibold mt-2 text-center ${isComplete ? 'text-teal' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {index < statusSteps.length - 1 && (
                      <div className={`h-1 w-full ${isComplete ? 'bg-teal' : 'bg-gray-200'} absolute top-6 left-1/2 -z-10`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Map */}
            <div className="card h-[500px]">
              <h2 className="text-xl font-bold mb-4">Live Location</h2>
              <Map
                center={[parseFloat(order.pickupLat), parseFloat(order.pickupLng)]}
                markers={markers}
                className="rounded-lg"
              />
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-primary" />
                  Locations
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Pickup</p>
                    <p className="font-semibold">{order.pickupAddress}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Dropoff</p>
                    <p className="font-semibold">{order.dropoffAddress}</p>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-gray-600">Distance: <span className="font-bold text-primary">{order.distanceKm} km</span></p>
                  </div>
                </div>
              </div>

              {rider && (
                <div className="card">
                  <h2 className="text-xl font-bold mb-4 flex items-center">
                    <User className="w-5 h-5 mr-2 text-teal" />
                    Rider Information
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-semibold">{rider.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Vehicle</p>
                      <p className="font-semibold">{rider.vehicleType} - {rider.plateNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Contact</p>
                      <a href={`tel:${rider.phone}`} className="text-primary font-semibold flex items-center">
                        <Phone className="w-4 h-4 mr-1" />
                        {rider.phone}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-accent" />
                  Timeline
                </h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600">Order Created</p>
                    <p className="font-semibold">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  {order.pickedUpAt && (
                    <div>
                      <p className="text-gray-600">Picked Up</p>
                      <p className="font-semibold">{new Date(order.pickedUpAt).toLocaleString()}</p>
                    </div>
                  )}
                  {order.deliveredAt && (
                    <div>
                      <p className="text-gray-600">Delivered</p>
                      <p className="font-semibold">{new Date(order.deliveredAt).toLocaleString()}</p>
                    </div>
                  )}
                  {order.estimatedDeliveryTime && !order.deliveredAt && (
                    <div>
                      <p className="text-gray-600">Estimated Delivery</p>
                      <p className="font-semibold text-teal">{new Date(order.estimatedDeliveryTime).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
