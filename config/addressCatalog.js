const snapshot = require("../data/vietnam-addresses.json");

const addressCatalog = Object.create(null);

const provinces = [...snapshot.provinces].sort(
    (a, b) => a.name.localeCompare(b.name, "vi")
);

for (const province of provinces) {
    addressCatalog[province.name] = Object.freeze(
        province.wards
            .map(ward => ward.name)
            .sort((a, b) => a.localeCompare(b, "vi"))
    );
}

module.exports = Object.freeze(addressCatalog);