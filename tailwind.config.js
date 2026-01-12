/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: {
                    main: '#09090b',
                    sidebar: '#0e0e10',
                    card: '#141416',
                },
                border: '#1f1f23',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                brand: ['Orbitron', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
