function pickCartId(req) {
  return req.query.cartId || req.headers["x-cart-id"] || req.body?.cartId || null;
}

module.exports = { pickCartId };
