import React from 'react';
import { X, Image as ImageIcon, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SeatingImage {
  id: string;
  url: string;
  base64: string;
  name?: string;
}

interface ImageStripProps {
  label: string;
  images: SeatingImage[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  presidentAt?: 'left' | 'right';
}

export const ImageStrip: React.FC<ImageStripProps> = ({ 
  label, 
  images, 
  onUpload, 
  onRemove,
  onReorder,
  presidentAt = 'left'
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
        <span className="text-[10px] text-gray-300 font-mono italic">{images.length} Photos</span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <label className="flex-shrink-0 w-24 h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={onUpload} 
            className="hidden" 
          />
          <Plus className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
          <span className="text-[9px] font-bold text-gray-400 group-hover:text-indigo-500 transition-colors">ADD PHOTO</span>
        </label>

        <AnimatePresence initial={false}>
          {images.map((img, index) => {
            // If Prez is at Right, the last image in the array is "Person 1"
            const displayIdx = presidentAt === 'left' ? index + 1 : images.length - index;
            
            return (
              <motion.div
                key={img.id}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex-shrink-0 w-24 h-24 relative group"
              >
                <img 
                  src={img.url} 
                  className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-sm" 
                  alt={`Seat ${displayIdx}`}
                />
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                  <button 
                    onClick={() => onRemove(img.id)}
                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Filename badge */}
                {img.name && (
                  <div className="absolute bottom-0.5 right-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[7px] text-white font-mono truncate max-w-[80px] pointer-events-none">
                    {img.name}
                  </div>
                )}

                <div className={`absolute -top-2 ${presidentAt === 'left' ? '-left-2' : '-right-2'} w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm ring-1 ring-black/5 transition-all`}>
                  {displayIdx}
                </div>

                {/* Simple reorder arrows */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {index > 0 && (
                    <button 
                      onClick={() => onReorder(img.id, 'up')}
                      className="p-1 bg-white border border-gray-200 rounded-md shadow-sm text-[8px] font-bold hover:bg-gray-50"
                    >
                      ←
                    </button>
                  )}
                  {index < images.length - 1 && (
                    <button 
                      onClick={() => onReorder(img.id, 'down')}
                      className="p-1 bg-white border border-gray-200 rounded-md shadow-sm text-[8px] font-bold hover:bg-gray-50"
                    >
                      →
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {images.length === 0 && (
          <div className="flex-1 flex items-center justify-center border-2 border-gray-50 rounded-xl bg-gray-50/30">
            <div className="flex items-center gap-2 text-gray-300 grayscale opacity-40">
              <ImageIcon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">No images uploaded</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
