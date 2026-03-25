// components/modals/ExpenseModal.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianRupee } from 'lucide-react';

export const ExpenseModal = ({ vehicle, onSave, onClose }) => {
  const [expenses, setExpenses] = useState(vehicle.expenses);

  const handleSave = () => {
    onSave(expenses);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-[500px]">
        <CardHeader>
          <CardTitle>Update Expenses - {vehicle.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(expenses).map(([key, value]) => (
              <div key={key}>
                <label className="text-sm font-medium capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type="number"
                    value={value}
                    className="pl-10"
                    onChange={(e) => 
                      setExpenses({ ...expenses, [key]: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">Save Expenses</Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};