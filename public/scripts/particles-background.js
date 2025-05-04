export function initParticlesBackground() {
    // Create the particles container if it doesn't exist
    if (!document.getElementById('particles-js')) {
        const particlesContainer = document.createElement('div');
        particlesContainer.id = 'particles-js';
        particlesContainer.style.position = 'absolute';
        particlesContainer.style.inset = '0';
        particlesContainer.style.zIndex = '1';
        particlesContainer.style.backgroundColor = 'transparent';
        particlesContainer.style.pointerEvents = 'none';
        document.body.insertBefore(particlesContainer, document.body.firstChild);
    } else {
        // If the div already exists, make sure it has pointer-events: none
        const particlesContainer = document.getElementById('particles-js');
        particlesContainer.style.pointerEvents = 'none';
    }

    // Initialize particles with configuration
    if (typeof window.particlesJS !== 'undefined') {
        window.particlesJS('particles-js', {
            "particles": {
                "number": {
                    "value": 43,
                    "density": {
                        "enable": true,
                        "value_area": 473.4885849793636
                    }
                },
                "color": {
                    "value": "#8e8e8e"
                },
                "shape": {
                    "type": "circle",
                    "stroke": {
                        "width": 0,
                        "color": "#000000"
                    },
                    "polygon": {
                        "nb_sides": 5
                    },
                    "image": {
                        "src": "img/github.svg",
                        "width": 100,
                        "height": 100
                    }
                },
                "opacity": {
                    "value": 0.5,
                    "random": false,
                    "anim": {
                        "enable": false,
                        "speed": 1,
                        "opacity_min": 0.1,
                        "sync": false
                    }
                },
                "size": {
                    "value": 3,
                    "random": true,
                    "anim": {
                        "enable": false,
                        "speed": 40,
                        "size_min": 0.1,
                        "sync": false
                    }
                },
                "line_linked": {
                    "enable": true,
                    "distance": 176.3753266952075,
                    "color": "#696969",
                    "opacity": 0.4,
                    "width": 1
                },
                "move": {
                    "enable": true,
                    "speed": 2,
                    "direction": "none",
                    "random": false,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false,
                    "attract": {
                        "enable": false,
                        "rotateX": 600,
                        "rotateY": 1200
                    }
                }
            },
            "interactivity": {
                "detect_on": "window",
                "events": {
                    "onhover": {
                        "enable": true,
                        "mode": "grab"
                    },
                    "onclick": {
                        "enable": true,
                        "mode": "push"
                    },
                    "resize": true
                },
                "modes": {
                    "grab": {
                        "distance": 170.53621458328246,
                        "line_linked": {
                            "opacity": 1
                        }
                    },
                    "bubble": {
                        "distance": 400,
                        "size": 40,
                        "duration": 2,
                        "opacity": 8,
                        "speed": 3
                    },
                    "repulse": {
                        "distance": 1,
                        "duration": 0.4
                    },
                    "push": {
                        "particles_nb": 4
                    },
                    "remove": {
                        "particles_nb": 2
                    }
                }
            },
            "retina_detect": true
        });
    }
}
