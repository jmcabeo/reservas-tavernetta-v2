import React from 'react';

const Maintenance = () => {
    return (
        <div className="min-h-screen bg-tav-black flex flex-col items-center justify-center p-4 text-center">
            <div className="max-w-md w-full border-2 border-tav-gold p-8 md:p-12 relative animate-fade-in">
                {/* Decorative corner squares */}
                <div className="absolute top-0 left-0 w-3 h-3 md:w-4 md:h-4 bg-tav-gold -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-tav-gold/20"></div>
                <div className="absolute top-0 right-0 w-3 h-3 md:w-4 md:h-4 bg-tav-gold translate-x-1/2 -translate-y-1/2 shadow-lg shadow-tav-gold/20"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 md:w-4 md:h-4 bg-tav-gold -translate-x-1/2 translate-y-1/2 shadow-lg shadow-tav-gold/20"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 bg-tav-gold translate-x-1/2 translate-y-1/2 shadow-lg shadow-tav-gold/20"></div>

                <h1 className="text-3xl md:text-5xl font-serif font-bold text-tav-gold mb-6 tracking-widest uppercase transform hover:scale-105 transition-transform duration-700">
                    La Tavernetta
                </h1>

                <div className="h-0.5 w-24 bg-tav-gold mx-auto mb-8 shadow-sm shadow-tav-gold/50"></div>

                <h2 className="text-lg md:text-2xl text-white font-light tracking-[0.2em] uppercase mb-4">
                    Próximamente
                </h2>

                <p className="text-gray-400 font-serif italic text-base md:text-lg leading-relaxed mb-8">
                    Estamos cocinando algo especial para ti.
                    <br />
                    Nuestra nueva experiencia de reservas estará disponible muy pronto.
                </p>

                <a
                    href="https://www.latavernetta.es"
                    className="inline-block px-8 py-3 bg-transparent border border-tav-gold text-tav-gold text-xs font-bold tracking-[0.15em] uppercase hover:bg-tav-gold hover:text-tav-black transition-all duration-300 transform hover:-translate-y-1"
                >
                    Volver a la web
                </a>

                <div className="mt-12 text-[10px] md:text-xs text-tav-gold opacity-40 tracking-widest uppercase">
                    Est. 2024 &bull; Cucina Autentica
                </div>
            </div>
        </div>
    );
};

export default Maintenance;
