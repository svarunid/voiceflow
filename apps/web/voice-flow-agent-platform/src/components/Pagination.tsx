import React from 'react';

interface PaginationProps {
  current_page: number;
  onPageChange: (page: number) => void;
  hasNextPage?: boolean;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  current_page,
  onPageChange,
  hasNextPage = true,
  className = ''
}) => {
  return (
    <nav className={`flex items-center justify-center space-x-4 ${className}`}>
      <button
        onClick={() => onPageChange(current_page - 1)}
        disabled={current_page === 1}
        className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>

      <button
        onClick={() => onPageChange(current_page + 1)}
        disabled={!hasNextPage}
        className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </nav>
  );
}
export default Pagination;
