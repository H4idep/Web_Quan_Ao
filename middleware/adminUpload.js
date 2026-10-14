const multer = require("multer");
const sharp = require("sharp");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs/promises");

const receiveImage = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 3 * 1024 * 1024,
        files: 1,
        fields: 0,
        parts: 1
    }
}).single("image");

function parseImage(req, res, next) {
    receiveImage(req, res, error => {
        if (error) {
            return res.status(400).json({
                error: "Chỉ tải một ảnh, dung lượng tối đa 3 MB."
            });
        }

        return next();
    });
}

async function saveImage(req, res, next) {
    if (!req.file) {
        return res.status(400).json({
            error: "Vui lòng chọn một ảnh."
        });
    }

    let output;

    try {
        const image = sharp(req.file.buffer, {
            limitInputPixels: 20_000_000
        });

        const metadata = await image.metadata();

        if (
            !["jpeg", "png", "webp"].includes(metadata.format) ||
            (metadata.pages || 1) > 1
        ) {
            return res.status(400).json({
                error: "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP không động."
            });
        }

        output = await image
            .rotate()
            .resize({
                width: 1600,
                height: 1600,
                fit: "inside",
                withoutEnlargement: true
            })
            .webp({ quality: 85 })
            .toBuffer();
    } catch {
        return res.status(400).json({
            error: "Ảnh bị lỗi, quá lớn hoặc không đúng định dạng."
        });
    }

    try {
        const filename = `${crypto.randomUUID()}.webp`;

        const directory = path.join(
            __dirname,
            "../public/uploads/products"
        );

        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, filename), output);

        return res.json({
            image_url: `/uploads/products/${filename}`
        });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    parseImage,
    saveImage
};