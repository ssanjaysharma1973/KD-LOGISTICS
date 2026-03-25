import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;