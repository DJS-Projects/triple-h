/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		serverActions: {
			// Document uploads (PDFs from scanners) routinely exceed Next's
			// default 1 MB Server Action body cap. Bump to 25 MB to cover
			// realistic delivery-order / weighing-bill scans without forcing
			// every upload through a separate route-handler proxy.
			bodySizeLimit: "25mb",
		},
	},
};

export default nextConfig;
