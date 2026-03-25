// components/modals/RouteModal.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const RouteModal = ({ vehicle, points, onSave, onClose }) => {
  const [routeData, setRouteData] = useState({
    start: vehicle?.route?.start || '',
    end: vehicle?.route?.end || '',
    stops: vehicle?.route?.stops || []
  });

  const handleSave = () => {
    onSave(routeData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-[500px]">
        <CardHeader>
          <CardTitle>Update Route - {vehicle.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Start Point</label>
              <select
                className="w-full mt-1 rounded-md border"
                value={routeData.start}
                onChange={(e) => setRouteData({ ...routeData, start: e.target.value })}
              >
                <option value="">Select Start Point</option>
                {points.map((point) => (
                  <option key={point.name} value={point.name}>
                    {point.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">End Point</label>
              <select
                className="w-full mt-1 rounded-md border"
                value={routeData.end}
                onChange={(e) => setRouteData({ ...routeData, end: e.target.value })}
              >
                <option value="">Select End Point</option>
                {points.map((point) => (
                  <option key={point.name} value={point.name}>
                    {point.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">Save Route</Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
