
import React, { useRef } from 'react';
import { EBook } from '../types';
import { Book, Upload, FileText, Trash2, PlayCircle, Plus } from 'lucide-react';

interface LibraryProps {
  books: EBook[];
  onUpload: (file: File) => void;
  onOpenBook: (book: EBook) => void;
  onDeleteBook: (id: string) => void;
}

const Library: React.FC<LibraryProps> = ({ books, onUpload, onOpenBook, onDeleteBook }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto pb-48">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-[#2C3E50] tracking-tight">Local Library</h1>
          <p className="text-gray-500 mt-2 font-medium">Upload and read your PDF and EPUB files with AI voice support.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-[#16A085] hover:bg-[#138d75] text-white px-8 py-4 rounded-2xl shadow-xl transition-all font-bold active:scale-95"
          >
            <Upload size={20} />
            Import Book
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.epub,.txt,.jpeg,.png,.webp" 
            onChange={handleFileChange} 
          />
        </div>
      </div>

      {/* Book Grid or Empty State */}
      {books.length === 0 ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border-4 border-dashed border-gray-100 rounded-[3.5rem] p-32 flex flex-col items-center text-center shadow-inner mt-8 cursor-pointer hover:border-[#16A085]/30 hover:bg-teal-50/10 transition-all group"
        >
          <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mb-10 group-hover:scale-110 transition-transform shadow-sm">
            <Book size={64} className="text-gray-200 group-hover:text-[#16A085]/40 transition-colors" />
          </div>
          <h3 className="text-3xl font-black text-[#2C3E50]">Your Shelf is Empty</h3>
          <p className="text-gray-400 mt-4 max-w-sm leading-relaxed font-medium">
            Click here to upload your first e-book. We support PDF, EPUB, and text files.
          </p>
          <div className="mt-10 flex items-center gap-2 text-[#16A085] font-black">
            <Plus size={24} />
            <span>Upload Now</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {books.map((book) => (
            <div
              key={book.id}
              className="group bg-white rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 relative flex flex-col h-full hover:-translate-y-2"
            >
              <div className="flex items-start gap-6 flex-1">
                <div className="p-5 rounded-2xl bg-teal-50 text-[#16A085] flex items-center justify-center transition-all shadow-sm group-hover:rotate-3 group-hover:bg-[#16A085] group-hover:text-white">
                  <FileText size={40} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-2xl leading-tight text-[#2C3E50] mb-3 group-hover:text-[#16A085] transition-colors line-clamp-2">
                    {book.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black px-3 py-1 bg-gray-100 text-gray-400 rounded-lg uppercase tracking-widest">
                      {book.format}
                    </span>
                    <span className="text-xs font-bold text-gray-300">
                      {book.content.length} segments
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button
                  onClick={() => onOpenBook(book)}
                  className="flex-1 flex items-center justify-center gap-3 bg-[#2C3E50] text-white py-5 rounded-2xl hover:bg-[#16A085] transition-all font-black text-sm shadow-xl active:scale-95"
                >
                  <PlayCircle size={24} />
                  Open Book
                </button>
                <button
                  onClick={() => onDeleteBook(book.id)}
                  className="p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-2xl"
                  title="Remove from Library"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Library;
