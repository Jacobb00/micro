FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# Copy csproj and restore as distinct layers
COPY ProductService/ProductService.csproj ProductService/
RUN dotnet restore "ProductService/ProductService.csproj"

# Copy everything else and build
COPY . .
WORKDIR /app/ProductService

# Force explicit install of Swagger packages
RUN dotnet add package Swashbuckle.AspNetCore --version 6.5.0
RUN dotnet add package Swashbuckle.AspNetCore.Swagger --version 6.5.0
RUN dotnet add package Swashbuckle.AspNetCore.SwaggerGen --version 6.5.0
RUN dotnet add package Swashbuckle.AspNetCore.SwaggerUI --version 6.5.0

# Build the app
RUN dotnet build "ProductService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ProductService.csproj" -c Release -o /app/publish

# Build runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
ENTRYPOINT ["dotnet", "ProductService.dll"] 