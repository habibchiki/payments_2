module.exports = async (req, res) => {
    return res.status(200).json({
        message: "Это новый create-payment",
        time: Date.now()
    });
};
