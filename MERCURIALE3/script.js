document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const searchInput = document.getElementById('searchInput');
    const sourceRadios = document.querySelectorAll('input[name="source"]');
    const searchResultsContainer = document.getElementById('searchResults');
    const orderListContainer = document.getElementById('orderList');
    const downloadBtn = document.getElementById('downloadCsvBtn');

    // Variables d'état
    let dataFolkestone = [];
    let dataVendome = [];
    let dataWashington = []; // AJOUT : Variable pour la nouvelle source
    let currentData = [];
    let orderList = [];
    
    // NOTE: La variable dataHeaders n'est plus globale pour plus de flexibilité.

    // --- INITIALISATION ---
    // MODIFICATION : On charge les trois fichiers JSON
    Promise.all([
        fetch('data/mercuriale-folkestone.json').then(response => response.json()),
        fetch('data/mercuriale-vendome.json').then(response => response.json()),
        fetch('data/mercuriale-washington.json').then(response => response.json()) // AJOUT : Fetch pour Washington
    ])
    .then(([folkestone, vendome, washington]) => {
        dataFolkestone = folkestone;
        dataVendome = vendome;
        dataWashington = washington; // AJOUT : Assignation des données de Washington

        setCurrentDataSource('folkestone'); // On commence par Folkestone par défaut
        console.log("Données chargées avec succès !");
    })
    .catch(error => {
        console.error("Erreur de chargement des fichiers JSON:", error);
        searchResultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Erreur: Impossible de charger les fichiers de données. Avez-vous démarré l'application via un serveur local (Live Server) ?</p>`;
    });

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    sourceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            setCurrentDataSource(e.target.value);
            searchInput.value = '';
            displaySearchResults([]);
        });
    });

    // La logique de recherche par code ou libellé est conservée telle quelle.
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            displaySearchResults([]);
            return;
        }
        
        const results = currentData.filter(item => {
            const codeProduit = item["Code Produit"]?.toString().toLowerCase() || '';
            const libelleProduit = item["Libellé produit"]?.toString().toLowerCase() || '';
            return codeProduit.includes(query) || libelleProduit.includes(query);
        });
        
        displaySearchResults(results);
    });
    
    searchResultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-add')) {
            const productCode = e.target.dataset.code;
            const source = document.querySelector('input[name="source"]:checked').value;
            addProductToOrder(productCode, source);
        }
    });
    
    orderListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            const productCode = e.target.dataset.code;
            const source = e.target.dataset.source;
            removeProductFromOrder(productCode, source);
        }
    });

    downloadBtn.addEventListener('click', downloadOrderAsCSV);

    // --- FONCTIONS LOGIQUES ---
    // MODIFICATION : Utilisation d'un 'switch' pour gérer facilement les 3 sources.
    function setCurrentDataSource(source) {
        switch (source) {
            case 'vendome':
                currentData = dataVendome;
                break;
            case 'washington':
                currentData = dataWashington;
                break;
            case 'folkestone':
            default:
                currentData = dataFolkestone;
                break;
        }
        updatePlaceholder();
    }
    
    function displaySearchResults(results) {
        if (results.length === 0) {
            updatePlaceholder();
            return;
        }
        
        // Les en-têtes sont déterminés à partir de la source actuelle
        const dataHeaders = currentData.length > 0 ? Object.keys(currentData[0]) : [];

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        ${dataHeaders.map(header => `<th>${header}</th>`).join('')}
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(item => `
                        <tr>
                            ${dataHeaders.map(header => `<td>${item[header] || ''}</td>`).join('')}
                            <td><button class="btn-add" data-code="${item["Code Produit"]}">Ajouter</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        searchResultsContainer.innerHTML = tableHTML;
    }
    
    function addProductToOrder(productCode, source) {
        const productCodeStr = productCode.toString();

        if (orderList.some(p => p["Code Produit"].toString() === productCodeStr && p.source === source)) {
            alert(`Cet article de la mercuriale "${source}" est déjà dans la liste de commande.`);
            return;
        }

        const productToAdd = currentData.find(p => p["Code Produit"].toString() === productCodeStr);
        if (productToAdd) {
            const productWithSource = { ...productToAdd, source: source };
            orderList.push(productWithSource);
            renderOrderList();
        }
    }
    
    function removeProductFromOrder(productCode, source) {
        const productCodeStr = productCode.toString();
        orderList = orderList.filter(p => 
            !(p["Code Produit"].toString() === productCodeStr && p.source === source)
        );
        renderOrderList();
    }

    function renderOrderList() {
        if (orderList.length === 0) {
            orderListContainer.innerHTML = `<p class="placeholder">Aucun article ajouté pour le moment.</p>`;
            downloadBtn.disabled = true;
            return;
        }

        // Amélioration : on génère les en-têtes à partir de tous les articles de la commande
        // pour s'assurer que toutes les colonnes sont affichées, même si elles varient entre les sources.
        const allHeadersInOrder = Array.from(new Set(orderList.flatMap(item => Object.keys(item)).filter(key => key !== 'source')));

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Source</th>
                        ${allHeadersInOrder.map(header => `<th>${header}</th>`).join('')}
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderList.map(item => `
                        <tr>
                            <td>${item.source}</td>
                            ${allHeadersInOrder.map(header => `<td>${item[header] || ''}</td>`).join('')}
                            <td><button class="btn-remove" data-code="${item["Code Produit"]}" data-source="${item.source}">Retirer</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        orderListContainer.innerHTML = tableHTML;
        downloadBtn.disabled = false;
    }
    
    function downloadOrderAsCSV() {
        if (orderList.length === 0) return;

        // On utilise la même logique robuste que pour l'affichage
        const allHeadersInOrder = Array.from(new Set(orderList.flatMap(item => Object.keys(item)).filter(key => key !== 'source')));
        const headersWithSource = ['Source', ...allHeadersInOrder];
        const csvHeaders = headersWithSource.join(';');
        
        const csvRows = orderList.map(row => {
            const cells = headersWithSource.map(header => {
                let cell = row[header] === null || row[header] === undefined ? '' : row[header];
                cell = cell.toString().replace(/"/g, '""'); 
                if (cell.includes(';') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell}"`; 
                }
                return cell;
            });
            return cells.join(';');
        });

        const csvContent = "\uFEFF" + [csvHeaders, ...csvRows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'ma_commande.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    function updatePlaceholder() {
        // Le placeholder est affiché seulement si la barre de recherche est vide.
        if(searchInput.value.trim().length < 2) {
            const sourceName = document.querySelector('input[name="source"]:checked').parentElement.textContent.trim();
            searchResultsContainer.innerHTML = `<p class="placeholder">Commencez à taper pour rechercher dans la mercuriale "${sourceName}".</p>`;
        }
    }
});