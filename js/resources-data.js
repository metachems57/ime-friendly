(function attachResourcesCatalog(globalScope) {
    const catalog = [
        {
            id: 'cra-lorraine',
            title: 'CRA Lorraine',
            description: 'Centre Ressources Autisme en Lorraine',
            url: 'https://epsytera.fr/cpn/centre-ressources-autisme-de-lorraine-cra/',
            image: 'images/ressources/cra-lorraine.png'
        },
        {
            id: 'ars-grand-est',
            title: 'ARS Grand Est',
            description: 'Agence regionale de sante - Grand Est',
            url: 'https://www.grand-est.ars.sante.fr/lars-grand-est',
            image: 'images/ressources/ars-grand-est.jpg'
        },
        {
            id: 'enfant-different',
            title: 'Enfant Different',
            description: 'Informations pratiques pour les familles',
            url: 'https://www.enfant-different.org/',
            image: 'images/ressources/enfant-different.png'
        },
        {
            id: 'handicap-gouv',
            title: 'Handicap.gouv.fr',
            description: 'Site officiel du gouvernement sur le handicap',
            url: 'https://handicap.gouv.fr/',
            image: 'images/ressources/handicap-gouv.jpg'
        },
        {
            id: 'handisport',
            title: 'Handisport',
            description: 'Federation francaise handisport',
            url: 'https://www.handisport.org/',
            image: 'images/ressources/handisport.png'
        },
        {
            id: 'autisme-info-service',
            title: 'Autisme Info Service',
            description: 'Ecoute, orientation et accompagnement',
            url: 'https://www.autismeinfoservice.fr/',
            image: 'images/ressources/autisme-info-service.png'
        },
        {
            id: 'larche-france',
            title: "L'Arche en France",
            description: 'Reseau de communautes inclusives et solidaires',
            url: 'https://www.arche-france.org/',
            image: 'images/ressources/larche-france.png'
        },
        {
            id: '10doigts',
            title: '10 Doigts',
            description: 'Activites creatives et ressources manuelles',
            url: 'https://www.10doigts.fr/',
            image: 'images/ressources/10doigts.png'
        },
        {
            id: 'ime-le-point-du-jour',
            title: 'IME Le Point du Jour',
            description: "Institut medico-educatif",
            url: 'https://www.ime-pierrevillers.com/',
            image: 'images/ressources/ime-le-point-du-jour.png'
        }
    ];

    globalScope.imeResources = catalog;
})(window);
